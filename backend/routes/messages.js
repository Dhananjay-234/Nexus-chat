// backend/routes/messages.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');
const { broadcastNewMessage, broadcastMessageDeleted } = require('../websocket');

const router = express.Router();
router.use(authMiddleware);

// Configure multer for file uploads (store in memory, then upload to Supabase Storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip', 'video/mp4', 'audio/mpeg'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'), false);
  }
});

// GET /api/messages/:conversationId - Get messages for a conversation
router.get('/:conversationId', async (req, res) => {
  try {
    // Verify membership
    const { data: membership } = await supabase
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', req.params.conversationId)
      .eq('user_id', req.user.id)
      .single();

    if (!membership) return res.status(403).json({ error: 'Not a member of this conversation' });

    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before; // cursor-based pagination

    let query = supabase
      .from('messages')
      .select(`
        id, conversation_id, content, type, file_url, file_name, file_size, file_type,
        is_deleted, created_at,
        sender_id,
        users!messages_sender_id_fkey(id, username, avatar_url, unique_id)
      `)
      .eq('conversation_id', req.params.conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data: messages, error } = await query;
    if (error) throw error;

    res.json((messages || []).reverse());
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages/:conversationId - Send a text/emoji message
router.post('/:conversationId', async (req, res) => {
  try {
    const { content, type = 'text' } = req.body;

    const { data: membership } = await supabase
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', req.params.conversationId)
      .eq('user_id', req.user.id)
      .single();

    if (!membership) return res.status(403).json({ error: 'Not a member' });
    if (!content || !content.trim()) return res.status(400).json({ error: 'Message content required' });

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: req.params.conversationId,
        sender_id: req.user.id,
        content: content.trim(),
        type
      })
      .select(`
        id, conversation_id, content, type, file_url, file_name, file_size, file_type,
        is_deleted, created_at, sender_id,
        users!messages_sender_id_fkey(id, username, avatar_url, unique_id)
      `)
      .single();

    if (error) throw error;

    // Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', req.params.conversationId);

    // ✅ BROADCAST to all conversation members via WebSocket
    await broadcastNewMessage(message);

    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages/:conversationId/upload - Upload file message
router.post('/:conversationId/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { data: membership } = await supabase
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', req.params.conversationId)
      .eq('user_id', req.user.id)
      .single();

    if (!membership) return res.status(403).json({ error: 'Not a member' });

    // Upload to Supabase Storage
    const ext = path.extname(req.file.originalname);
    const fileName = `${req.params.conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      // If storage bucket doesn't exist, store as base64 URL fallback
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ error: 'File upload failed. Ensure "chat-files" storage bucket exists in Supabase.' });
    }

    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(fileName);
    const fileUrl = urlData.publicUrl;

    const isImage = req.file.mimetype.startsWith('image/');
    const msgType = isImage ? 'image' : 'file';

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: req.params.conversationId,
        sender_id: req.user.id,
        content: req.file.originalname,
        type: msgType,
        file_url: fileUrl,
        file_name: req.file.originalname,
        file_size: req.file.size,
        file_type: req.file.mimetype
      })
      .select(`
        id, conversation_id, content, type, file_url, file_name, file_size, file_type,
        is_deleted, created_at, sender_id,
        users!messages_sender_id_fkey(id, username, avatar_url, unique_id)
      `)
      .single();

    if (error) throw error;

    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', req.params.conversationId);

    // ✅ BROADCAST file message to all conversation members via WebSocket
    await broadcastNewMessage(message);

    res.status(201).json(message);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Server error during file upload' });
  }
});

// DELETE /api/messages/:messageId - Delete a message
router.delete('/:messageId', async (req, res) => {
  try {
    // Get the message
    const { data: message, error: mErr } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id')
      .eq('id', req.params.messageId)
      .single();

    if (mErr || !message) return res.status(404).json({ error: 'Message not found' });

    // Check membership and permissions
    const { data: membership } = await supabase
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', message.conversation_id)
      .eq('user_id', req.user.id)
      .single();

    if (!membership) return res.status(403).json({ error: 'Not a member' });

    // Allow: message sender OR group admin
    const canDelete = message.sender_id === req.user.id || membership.role === 'admin';
    if (!canDelete) return res.status(403).json({ error: 'Cannot delete this message' });

    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true, deleted_by: req.user.id, deleted_at: new Date().toISOString() })
      .eq('id', req.params.messageId);

    if (error) throw error;

    // ✅ BROADCAST deletion to all conversation members via WebSocket
    await broadcastMessageDeleted(req.params.messageId, message.conversation_id, req.user.id);

    res.json({ message: 'Message deleted', messageId: req.params.messageId });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
