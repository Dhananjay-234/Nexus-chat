// backend/routes/conversations.js
const express = require('express');
const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/conversations - Get all conversations for current user
router.get('/', async (req, res) => {
  try {
    // Get all conversations where user is a member
    const { data: memberships, error: mErr } = await supabase
      .from('conversation_members')
      .select('conversation_id, role')
      .eq('user_id', req.user.id);

    if (mErr) throw mErr;
    if (!memberships || memberships.length === 0) return res.json([]);

    const convIds = memberships.map(m => m.conversation_id);

    // Fetch conversation details
    const { data: conversations, error: cErr } = await supabase
      .from('conversations')
      .select('*')
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (cErr) throw cErr;

    // For each conversation get members and last message
    const result = await Promise.all(conversations.map(async (conv) => {
      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id, role, joined_at, users(id, unique_id, username, avatar_url, status)')
        .eq('conversation_id', conv.id);

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('id, content, type, sender_id, created_at, is_deleted, users(username)')
        .eq('conversation_id', conv.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1);

      const myRole = memberships.find(m => m.conversation_id === conv.id)?.role;

      return {
        ...conv,
        members: members || [],
        last_message: lastMsg?.[0] || null,
        my_role: myRole
      };
    }));

    res.json(result);
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/conversations/direct - Start or get direct conversation
router.post('/direct', async (req, res) => {
  try {
    const { target_user_id } = req.body;
    if (!target_user_id) return res.status(400).json({ error: 'target_user_id required' });

    // Check if direct conversation already exists between the two users
    const { data: myConvs } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', req.user.id);

    const { data: theirConvs } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', target_user_id);

    const myIds = new Set((myConvs || []).map(m => m.conversation_id));
    const sharedIds = (theirConvs || []).map(m => m.conversation_id).filter(id => myIds.has(id));

    if (sharedIds.length > 0) {
      // Check which of these is a direct conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .in('id', sharedIds)
        .eq('type', 'direct')
        .limit(1);

      if (existing && existing.length > 0) {
        const conv = existing[0];
        const { data: members } = await supabase
          .from('conversation_members')
          .select('user_id, role, users(id, unique_id, username, avatar_url, status)')
          .eq('conversation_id', conv.id);
        return res.json({ ...conv, members: members || [], my_role: 'member' });
      }
    }

    // Create new direct conversation
    const { data: conv, error: cErr } = await supabase
      .from('conversations')
      .insert({ type: 'direct', created_by: req.user.id })
      .select()
      .single();
    if (cErr) throw cErr;

    // Add both users as members
    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: req.user.id, role: 'member' },
      { conversation_id: conv.id, user_id: target_user_id, role: 'member' }
    ]);

    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id, role, users(id, unique_id, username, avatar_url, status)')
      .eq('conversation_id', conv.id);

    res.status(201).json({ ...conv, members: members || [], my_role: 'member' });
  } catch (err) {
    console.error('Direct conversation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/conversations/group - Create group conversation
router.post('/group', async (req, res) => {
  try {
    const { name, description, member_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name required' });

    const { data: conv, error: cErr } = await supabase
      .from('conversations')
      .insert({ type: 'group', name, description, created_by: req.user.id })
      .select()
      .single();
    if (cErr) throw cErr;

    // Creator is admin
    const membersToAdd = [
      { conversation_id: conv.id, user_id: req.user.id, role: 'admin' }
    ];

    // Add other members
    const uniqueIds = [...new Set((member_ids || []).filter(id => id !== req.user.id))];
    for (const uid of uniqueIds) {
      membersToAdd.push({ conversation_id: conv.id, user_id: uid, role: 'member' });
    }

    await supabase.from('conversation_members').insert(membersToAdd);

    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id, role, users(id, unique_id, username, avatar_url, status)')
      .eq('conversation_id', conv.id);

    res.status(201).json({ ...conv, members: members || [], my_role: 'admin' });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/conversations/:id - Get single conversation
router.get('/:id', async (req, res) => {
  try {
    // Verify membership
    const { data: membership } = await supabase
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!membership) return res.status(403).json({ error: 'Not a member of this conversation' });

    const { data: conv, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !conv) return res.status(404).json({ error: 'Conversation not found' });

    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id, role, joined_at, users(id, unique_id, username, avatar_url, status)')
      .eq('conversation_id', conv.id);

    res.json({ ...conv, members: members || [], my_role: membership.role });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/conversations/:id/members - Add member (admin only for groups)
router.post('/:id/members', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const { data: myMembership } = await supabase
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!myMembership) return res.status(403).json({ error: 'Not a member' });
    if (myMembership.role !== 'admin') return res.status(403).json({ error: 'Only admins can add members' });

    const { error } = await supabase
      .from('conversation_members')
      .insert({ conversation_id: req.params.id, user_id, role: 'member' });

    if (error && error.code === '23505') return res.status(409).json({ error: 'User already a member' });
    if (error) throw error;

    res.json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/conversations/:id/members/:userId - Remove member (admin only)
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const { data: myMembership } = await supabase
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!myMembership) return res.status(403).json({ error: 'Not a member' });

    // Admins can remove others; users can remove themselves (leave)
    if (req.params.userId !== req.user.id && myMembership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.params.userId);

    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
