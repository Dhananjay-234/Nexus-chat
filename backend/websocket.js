// backend/websocket.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const supabase = require('./supabase');

// Map: userId -> Set of WebSocket connections (a user can have multiple tabs)
const userConnections = new Map();

// Map: conversationId -> Set of userIds who are currently in the conversation
const conversationPresence = new Map();

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    // Extract token from query string: ws://...?token=xxx
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let user;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      ws.close(4001, 'Invalid token');
      return;
    }

    ws.userId = user.id;
    ws.username = user.username;
    ws.isAlive = true;

    // Register connection
    if (!userConnections.has(user.id)) userConnections.set(user.id, new Set());
    userConnections.get(user.id).add(ws);

    // Update user status to online
    await supabase.from('users').update({ status: 'online', last_seen: new Date().toISOString() }).eq('id', user.id);

    // Broadcast online status to all connected users
    broadcastUserStatus(user.id, 'online');

    console.log(`[WS] User ${user.username} connected. Total connections: ${getTotalConnections()}`);

    // Send welcome
    sendToSocket(ws, { type: 'connected', userId: user.id, username: user.username });

    // Heartbeat
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleMessage(ws, user, msg);
      } catch (err) {
        console.error('[WS] Message parse error:', err);
        sendToSocket(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', async () => {
      // Remove this connection
      const conns = userConnections.get(user.id);
      if (conns) {
        conns.delete(ws);
        if (conns.size === 0) {
          userConnections.delete(user.id);
          // User truly offline
          await supabase.from('users').update({ status: 'offline', last_seen: new Date().toISOString() }).eq('id', user.id);
          broadcastUserStatus(user.id, 'offline');
        }
      }
      console.log(`[WS] User ${user.username} disconnected`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for user ${user.username}:`, err.message);
    });
  });

  // Heartbeat interval — ping every 30s
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  return wss;
}

async function handleMessage(ws, user, msg) {
  switch (msg.type) {

    case 'join_conversation': {
      // User opens a conversation — track presence
      const convId = msg.conversationId;
      if (!convId) return;

      // Verify membership
      const { data: membership } = await supabase
        .from('conversation_members')
        .select('role')
        .eq('conversation_id', convId)
        .eq('user_id', user.id)
        .single();
      if (!membership) return;

      if (!conversationPresence.has(convId)) conversationPresence.set(convId, new Set());
      conversationPresence.get(convId).add(user.id);
      ws.currentConversation = convId;

      // Notify others in conversation user is viewing it (typing indicators etc.)
      broadcastToConversation(convId, { type: 'user_joined_view', userId: user.id, username: user.username }, user.id);
      break;
    }

    case 'leave_conversation': {
      const convId = msg.conversationId || ws.currentConversation;
      if (convId && conversationPresence.has(convId)) {
        conversationPresence.get(convId).delete(user.id);
      }
      ws.currentConversation = null;
      break;
    }

    case 'typing': {
      const { conversationId, isTyping } = msg;
      if (!conversationId) return;
      broadcastToConversation(conversationId, {
        type: 'typing',
        userId: user.id,
        username: user.username,
        conversationId,
        isTyping: !!isTyping
      }, user.id);
      break;
    }

    case 'ping': {
      sendToSocket(ws, { type: 'pong' });
      break;
    }

    default:
      sendToSocket(ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
  }
}

// ---- Broadcast helpers ----

function sendToSocket(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function sendToUser(userId, data) {
  const conns = userConnections.get(userId);
  if (!conns) return;
  conns.forEach(ws => sendToSocket(ws, data));
}

function broadcastToConversation(conversationId, data, excludeUserId = null) {
  const presence = conversationPresence.get(conversationId);
  // We broadcast to all connected users who are members — presence is "active view"
  // For messages, we broadcast to ALL members regardless of presence
  userConnections.forEach((conns, userId) => {
    if (excludeUserId && userId === excludeUserId) return;
    conns.forEach(ws => sendToSocket(ws, data));
  });
}

async function broadcastNewMessage(message) {
  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', message.conversation_id);

  if (!members) return;

  members.forEach(({ user_id }) => {
    // ✅ Skip the sender — they already appended it on the frontend
    if (user_id === message.sender_id) return;
    sendToUser(user_id, { type: 'new_message', message });
  });
}

async function broadcastMessageDeleted(messageId, conversationId, deletedBy) {
  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId);

  if (!members) return;

  members.forEach(({ user_id }) => {
    sendToUser(user_id, { type: 'message_deleted', messageId, conversationId, deletedBy });
  });
}

async function broadcastConversationUpdate(conversationId, updateData) {
  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId);

  if (!members) return;

  members.forEach(({ user_id }) => {
    sendToUser(user_id, { type: 'conversation_updated', conversationId, ...updateData });
  });
}

function broadcastUserStatus(userId, status) {
  const data = { type: 'user_status', userId, status };
  userConnections.forEach((conns, uid) => {
    if (uid !== userId) conns.forEach(ws => sendToSocket(ws, data));
  });
}

function getTotalConnections() {
  let total = 0;
  userConnections.forEach(conns => { total += conns.size; });
  return total;
}

module.exports = {
  setupWebSocket,
  broadcastNewMessage,
  broadcastMessageDeleted,
  broadcastConversationUpdate,
  sendToUser
};
