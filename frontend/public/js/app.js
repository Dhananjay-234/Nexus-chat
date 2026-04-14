// ════════════════════════════════════════════════
//  NEXUS CHAT — Frontend App
// ════════════════════════════════════════════════

const API = '';  // Empty = same origin. Change to 'http://localhost:3000' if running separately

// ── State ────────────────────────────────────────
let currentUser = null;
let token = null;
let ws = null;
let conversations = [];
let activeConvId = null;
let activeConv = null;
let typingTimer = null;
let isTyping = false;
let selectedGroupMembers = [];

// ── Emoji data ───────────────────────────────────
const EMOJI_CATEGORIES = {
  'Smileys': ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳'],
  'Gestures': ['👍','👎','👌','🤌','🤞','✌️','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👋','🤚','🖐️','✋','🖖','💪','🦾','🫀','🦷','🦴'],
  'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️'],
  'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉'],
  'Food': ['🍎','🍊','🍋','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🫑','🌽','🥕','🧅','🥔','🍠','🥜','🫘','🌰','🍞'],
  'Objects': ['💡','🔑','🗝️','🔒','🔓','🔨','🪓','⛏️','🔧','🪛','🔩','⚙️','🪝','🧲','💻','🖥️','📱','⌨️','🖱️','📷','📸','📹','🎥'],
  'Symbols': ['✅','❌','⚠️','🚫','💯','🔥','⭐','🌟','💫','✨','🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','🎯','🎮','🃏','🎲','🧩'],
};

// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  token = localStorage.getItem('nexus_token');
  const savedUser = localStorage.getItem('nexus_user');
  if (token && savedUser) {
    currentUser = JSON.parse(savedUser);
    initApp();
  }
  buildEmojiPicker();

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.emoji-trigger') && !e.target.closest('.emoji-picker')) {
      document.getElementById('emoji-picker').classList.add('hidden');
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
});

function initApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateUserUI();
  connectWebSocket();
  loadConversations();
}

function updateUserUI() {
  document.getElementById('my-username').textContent = currentUser.username;
  document.getElementById('my-unique-id').textContent = currentUser.unique_id;
  document.getElementById('my-avatar').textContent = currentUser.username[0].toUpperCase();
}

// ════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`${tab}-form`).classList.add('active');
}

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
});

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please fill in all fields'; return; }

  setButtonLoading(btn, true);
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login failed'; return; }

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user', JSON.stringify(currentUser));
    initApp();
  } catch (err) {
    errEl.textContent = 'Network error. Is the server running?';
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('register-error');
  const btn = document.getElementById('register-btn');

  errEl.textContent = '';
  if (!username || !email || !password) { errEl.textContent = 'Please fill in all fields'; return; }

  setButtonLoading(btn, true);
  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Registration failed'; return; }

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user', JSON.stringify(currentUser));
    showToast(`Welcome, ${currentUser.username}! Your ID: ${currentUser.unique_id}`, 'success');
    initApp();
  } catch (err) {
    errEl.textContent = 'Network error. Is the server running?';
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleLogout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (_) {}
  if (ws) ws.close();
  localStorage.removeItem('nexus_token');
  localStorage.removeItem('nexus_user');
  token = null; currentUser = null; conversations = []; activeConvId = null;
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

// ════════════════════════════════════════════════
//  WEBSOCKET
// ════════════════════════════════════════════════
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host || 'localhost:3000';
  const wsUrl = `${protocol}//${host}/ws?token=${token}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WS] Connected');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWsMessage(msg);
    } catch (err) {
      console.error('[WS] Parse error', err);
    }
  };

  ws.onclose = (event) => {
    console.log('[WS] Closed:', event.code, event.reason);
    if (event.code !== 4001 && token) {
      setTimeout(connectWebSocket, 3000);
    }
  };

  ws.onerror = (err) => {
    console.error('[WS] Error:', err);
  };
}

function handleWsMessage(msg) {
  switch (msg.type) {
    case 'new_message':
      handleIncomingMessage(msg.message);
      break;
    case 'message_deleted':
      handleMessageDeleted(msg.messageId, msg.conversationId);
      break;
    case 'typing':
      handleTypingEvent(msg);
      break;
    case 'user_status':
      handleUserStatus(msg.userId, msg.status);
      break;
    case 'conversation_updated':
      loadConversations();
      break;
    case 'connected':
      console.log('[WS] Authenticated as', msg.username);
      break;
  }
}

function sendWsMessage(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// ════════════════════════════════════════════════
//  CONVERSATIONS
// ════════════════════════════════════════════════
async function loadConversations() {
  try {
    const data = await apiFetch('/api/conversations');
    conversations = data || [];
    renderConversationList();
  } catch (err) {
    console.error('Load conversations error:', err);
  }
}

function renderConversationList() {
  const list = document.getElementById('conv-list');
  const filter = document.getElementById('conv-search').value.toLowerCase();

  const filtered = conversations.filter(c => {
    const name = getConvName(c).toLowerCase();
    return name.includes(filter);
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state-sidebar"><span>No conversations</span><small>${filter ? 'No match found' : 'Start a chat or create a group'}</small></div>`;
    return;
  }

  list.innerHTML = filtered.map(conv => {
    const name = getConvName(conv);
    const initial = name[0]?.toUpperCase() || '?';
    const isGroup = conv.type === 'group';
    const lastMsg = conv.last_message;
    const lastMsgText = lastMsg
      ? (lastMsg.is_deleted ? '🗑 Message deleted' : (lastMsg.type !== 'text' ? `📎 ${lastMsg.content}` : lastMsg.content))
      : 'No messages yet';
    const time = lastMsg ? formatTime(lastMsg.created_at) : '';
    const isActive = conv.id === activeConvId;

    let statusHtml = '';
    if (!isGroup) {
      const other = getOtherMember(conv);
      const statusClass = other?.users?.status || 'offline';
      statusHtml = `<div class="status-dot ${statusClass}" style="position:absolute;bottom:0;right:0;border-color:var(--bg-secondary)"></div>`;
    }

    return `
      <div class="conv-item ${isActive ? 'active' : ''}" onclick="openConversation('${conv.id}')" data-conv-id="${conv.id}">
        <div class="conv-avatar-wrap" style="position:relative">
          <div class="avatar" style="${isGroup ? 'background: linear-gradient(135deg, #FF6B9D, #FF9A6C)' : ''}">${initial}</div>
          ${statusHtml}
        </div>
        <div class="conv-item-info">
          <div class="conv-item-top">
            <span class="conv-item-name">${escapeHtml(name)}</span>
            ${time ? `<span class="conv-item-time">${time}</span>` : ''}
          </div>
          <div class="conv-item-preview">${isGroup ? `<span class="group-badge">GROUP</span> ` : ''}${escapeHtml(lastMsgText)}</div>
        </div>
      </div>`;
  }).join('');
}

function filterConversations() {
  renderConversationList();
}

function getConvName(conv) {
  if (conv.type === 'group') return conv.name || 'Group';
  const other = getOtherMember(conv);
  return other?.users?.username || 'Unknown';
}

function getOtherMember(conv) {
  return conv.members?.find(m => m.user_id !== currentUser.id);
}

async function openConversation(convId) {
  activeConvId = convId;
  activeConv = conversations.find(c => c.id === convId);

  if (!activeConv) {
    try {
      activeConv = await apiFetch(`/api/conversations/${convId}`);
    } catch (err) {
      showToast('Failed to load conversation', 'error');
      return;
    }
  }

  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`[data-conv-id="${convId}"]`);
  if (el) el.classList.add('active');

  const name = getConvName(activeConv);
  document.getElementById('chat-name').textContent = name;
  document.getElementById('chat-avatar').textContent = name[0]?.toUpperCase() || '?';
  if (activeConv.type === 'group') {
    document.getElementById('chat-avatar').style.background = 'linear-gradient(135deg, #FF6B9D, #FF9A6C)';
    const count = activeConv.members?.length || 0;
    document.getElementById('chat-status').textContent = `${count} members`;
  } else {
    document.getElementById('chat-avatar').style.background = '';
    const other = getOtherMember(activeConv);
    const status = other?.users?.status || 'offline';
    document.getElementById('chat-status').textContent = status === 'online' ? '🟢 Online' : '⚫ Offline';
  }

  document.getElementById('chat-empty').classList.add('hidden');
  document.getElementById('chat-view').classList.remove('hidden');
  closeMembersPanel();

  sendWsMessage({ type: 'join_conversation', conversationId: convId });
  await loadMessages(convId);
}

// ════════════════════════════════════════════════
//  MESSAGES
// ════════════════════════════════════════════════
async function loadMessages(convId) {
  const area = document.getElementById('messages-area');
  area.innerHTML = '<div class="messages-loader"><div class="spinner"></div></div>';

  try {
    const messages = await apiFetch(`/api/messages/${convId}`);
    renderMessages(messages);
  } catch (err) {
    area.innerHTML = `<p style="color:var(--danger);text-align:center;padding:40px">Failed to load messages</p>`;
  }
}

function renderMessages(messages) {
  const area = document.getElementById('messages-area');
  area.innerHTML = '';

  if (!messages || messages.length === 0) {
    area.innerHTML = `<div class="empty-state-sidebar" style="margin:auto"><span>No messages yet</span><small>Start the conversation!</small></div>`;
    return;
  }

  let lastDate = null;
  messages.forEach(msg => {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== lastDate) {
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.textContent = formatDate(msg.created_at);
      area.appendChild(sep);
      lastDate = msgDate;
    }
    area.appendChild(createMessageElement(msg));
  });

  scrollToBottom();
}

function createMessageElement(msg) {
  const isSelf = msg.sender_id === currentUser.id;
  const sender = msg.users;

  const row = document.createElement('div');
  row.className = `message-row ${isSelf ? 'self' : ''}`;
  row.dataset.messageId = msg.id;

  const senderInitial = sender?.username?.[0]?.toUpperCase() || '?';
  const canDelete = isSelf || activeConv?.my_role === 'admin';

  let content = '';
  if (msg.is_deleted) {
    content = `<div class="message-bubble deleted">🗑 Message deleted</div>`;
  } else if (msg.type === 'image') {
    content = `
      <div class="message-bubble" style="padding:6px;${isSelf ? 'background:var(--msg-self);border:none' : ''}">
        ${canDelete ? `<button class="delete-btn" onclick="deleteMessage('${msg.id}')">✕</button>` : ''}
        <img src="${escapeHtml(msg.file_url)}" class="message-image" onclick="window.open('${escapeHtml(msg.file_url)}','_blank')" alt="${escapeHtml(msg.file_name || 'image')}" loading="lazy" />
      </div>`;
  } else if (msg.type === 'file') {
    const size = formatFileSize(msg.file_size);
    content = `
      <div class="message-bubble" style="${isSelf ? 'background:var(--msg-self);border:none' : ''}">
        ${canDelete ? `<button class="delete-btn" onclick="deleteMessage('${msg.id}')">✕</button>` : ''}
        <a href="${escapeHtml(msg.file_url)}" target="_blank" class="message-file" download="${escapeHtml(msg.file_name)}">
          <div class="file-icon">
            <svg width="18" height="18" fill="none" stroke="${isSelf ? 'white' : 'var(--accent)'}" stroke-width="2" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          </div>
          <div class="file-info">
            <div class="file-name">${escapeHtml(msg.file_name || 'File')}</div>
            <div class="file-size">${size}</div>
          </div>
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        </a>
      </div>`;
  } else {
    content = `
      <div class="message-bubble">
        ${canDelete ? `<button class="delete-btn" onclick="deleteMessage('${msg.id}')">✕</button>` : ''}
        ${escapeHtml(msg.content).replace(/\n/g, '<br>')}
      </div>`;
  }

  const showSender = activeConv?.type === 'group' && !isSelf;

  row.innerHTML = `
    ${!isSelf ? `<div class="avatar sm">${senderInitial}</div>` : ''}
    <div class="message-bubble-wrap">
      ${showSender ? `<div class="message-sender">${escapeHtml(sender?.username || 'Unknown')}</div>` : ''}
      ${content}
      <div class="message-time">${formatTime(msg.created_at)}</div>
    </div>`;

  return row;
}

function appendMessage(msg) {
  const area = document.getElementById('messages-area');
  const emptyEl = area.querySelector('.empty-state-sidebar');
  if (emptyEl) emptyEl.remove();

  const lastSep = area.querySelectorAll('.date-separator');
  const lastSepDate = lastSep.length ? lastSep[lastSep.length - 1].textContent : null;
  const formattedDate = formatDate(msg.created_at);
  if (formattedDate !== lastSepDate) {
    const sep = document.createElement('div');
    sep.className = 'date-separator';
    sep.textContent = formattedDate;
    area.appendChild(sep);
  }

  area.appendChild(createMessageElement(msg));
  scrollToBottom();
}

// ✅ FIX: Incoming WS messages are only from OTHER users (sender is excluded
//    in websocket.js broadcastNewMessage). So we always append here safely.
function handleIncomingMessage(msg) {
  const conv = conversations.find(c => c.id === msg.conversation_id);
  if (conv) {
    conv.last_message = msg;
    conv.updated_at = msg.created_at;
    conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    renderConversationList();
  } else {
    loadConversations();
  }

  if (msg.conversation_id === activeConvId) {
    appendMessage(msg);
  } else {
    showToast(`New message in ${conv ? getConvName(conv) : 'a conversation'}`, '');
  }
}

function handleMessageDeleted(messageId, convId) {
  const row = document.querySelector(`[data-message-id="${messageId}"]`);
  if (row) {
    const bubble = row.querySelector('.message-bubble');
    if (bubble) {
      bubble.className = 'message-bubble deleted';
      bubble.innerHTML = '🗑 Message deleted';
    }
  }

  const conv = conversations.find(c => c.id === convId);
  if (conv && conv.last_message?.id === messageId) {
    conv.last_message.is_deleted = true;
    renderConversationList();
  }
}

// ✅ FIX: sendMessage appends immediately for the SENDER via HTTP response.
//    The backend will NOT echo it back via WS to the sender (fixed in websocket.js).
//    All other members receive it via WS normally.
async function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content || !activeConvId) return;

  input.value = '';
  autoResizeTextarea(input);
  stopTyping();

  try {
    const message = await apiFetch(`/api/messages/${activeConvId}`, {
      method: 'POST',
      body: JSON.stringify({ content, type: 'text' })
    });
    // Append for sender immediately
    appendMessage(message);
    // Update sidebar
    const conv = conversations.find(c => c.id === activeConvId);
    if (conv) {
      conv.last_message = message;
      conv.updated_at = message.created_at;
      conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      renderConversationList();
    }
  } catch (err) {
    showToast('Failed to send message', 'error');
    input.value = content;
  }
}

async function deleteMessage(messageId) {
  if (!confirm('Delete this message?')) return;
  try {
    await apiFetch(`/api/messages/${messageId}`, { method: 'DELETE' });
    // UI updated via WebSocket broadcast
  } catch (err) {
    showToast('Failed to delete message', 'error');
  }
}

// ════════════════════════════════════════════════
//  FILE UPLOAD
// ════════════════════════════════════════════════
// ✅ FIX: Same pattern as sendMessage — append immediately for sender.
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file || !activeConvId) return;

  if (file.size > 25 * 1024 * 1024) {
    showToast('File too large (max 25MB)', 'error');
    return;
  }

  showToast('Uploading file...', '');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API}/api/messages/${activeConvId}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    const message = await res.json();
    // Append for sender immediately
    appendMessage(message);
    const conv = conversations.find(c => c.id === activeConvId);
    if (conv) {
      conv.last_message = message;
      conv.updated_at = message.created_at;
      conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      renderConversationList();
    }
    showToast('File sent!', 'success');
  } catch (err) {
    showToast(`Upload failed: ${err.message}`, 'error');
  }

  event.target.value = '';
}

// ════════════════════════════════════════════════
//  TYPING INDICATOR
// ════════════════════════════════════════════════
function handleInputChange() {
  const input = document.getElementById('message-input');
  autoResizeTextarea(input);

  if (!isTyping) {
    isTyping = true;
    sendWsMessage({ type: 'typing', conversationId: activeConvId, isTyping: true });
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 2000);
}

function stopTyping() {
  if (isTyping) {
    isTyping = false;
    sendWsMessage({ type: 'typing', conversationId: activeConvId, isTyping: false });
  }
  clearTimeout(typingTimer);
}

let typingUsers = {};
function handleTypingEvent(msg) {
  if (msg.conversationId !== activeConvId || msg.userId === currentUser.id) return;

  if (msg.isTyping) {
    typingUsers[msg.userId] = msg.username;
  } else {
    delete typingUsers[msg.userId];
  }

  const names = Object.values(typingUsers);
  const indicator = document.getElementById('typing-indicator');
  if (names.length > 0) {
    document.getElementById('typing-text').textContent =
      names.length === 1 ? `${names[0]} is typing...` : `${names.join(', ')} are typing...`;
    indicator.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
  }
}

function handleInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ════════════════════════════════════════════════
//  USER STATUS
// ════════════════════════════════════════════════
function handleUserStatus(userId, status) {
  conversations.forEach(conv => {
    if (conv.type === 'direct') {
      const other = getOtherMember(conv);
      if (other && other.user_id === userId) {
        if (other.users) other.users.status = status;
      }
    }
  });
  renderConversationList();

  if (activeConv && activeConv.type === 'direct') {
    const other = getOtherMember(activeConv);
    if (other && other.user_id === userId) {
      document.getElementById('chat-status').textContent = status === 'online' ? '🟢 Online' : '⚫ Offline';
    }
  }
}

// ════════════════════════════════════════════════
//  SEARCH USERS
// ════════════════════════════════════════════════
let searchTimer;

function openNewChatModal() {
  document.getElementById('new-chat-modal').classList.remove('hidden');
  document.getElementById('user-search-input').value = '';
  document.getElementById('user-search-results').innerHTML = '<p class="search-hint">Start typing to search users</p>';
  setTimeout(() => document.getElementById('user-search-input').focus(), 100);
}

async function searchUsers() {
  clearTimeout(searchTimer);
  const q = document.getElementById('user-search-input').value.trim();
  if (!q) {
    document.getElementById('user-search-results').innerHTML = '<p class="search-hint">Start typing to search users</p>';
    return;
  }

  searchTimer = setTimeout(async () => {
    try {
      const param = q.toUpperCase().startsWith('USR-') ? `unique_id=${encodeURIComponent(q)}` : `username=${encodeURIComponent(q)}`;
      const results = await apiFetch(`/api/users/search?${param}`);
      renderUserResults(results, 'user-search-results', (user) => startDirectChat(user));
    } catch (err) {
      document.getElementById('user-search-results').innerHTML = '<p class="search-hint">Search failed</p>';
    }
  }, 300);
}

function renderUserResults(users, containerId, onAction, actionLabel = 'Chat') {
  const el = document.getElementById(containerId);
  if (!users || users.length === 0) {
    el.innerHTML = '<p class="search-hint">No users found</p>';
    return;
  }
  el.innerHTML = users.map(u => `
    <div class="user-result-item">
      <div class="avatar sm">${u.username[0].toUpperCase()}</div>
      <div class="user-result-info">
        <div class="user-result-name">${escapeHtml(u.username)}</div>
        <div class="user-result-uid">${escapeHtml(u.unique_id)}</div>
      </div>
      <button class="user-result-action" onclick="userResultAction('${u.id}', '${escapeHtml(u.username || '')}')"> ${actionLabel}</button>
    </div>`).join('');

  el.querySelectorAll('.user-result-action').forEach((btn, i) => {
    btn.onclick = () => onAction(users[i]);
  });
}

async function startDirectChat(user) {
  closeModal('new-chat-modal');
  try {
    const conv = await apiFetch('/api/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ target_user_id: user.id })
    });
    const existing = conversations.findIndex(c => c.id === conv.id);
    if (existing === -1) {
      conversations.unshift(conv);
    } else {
      conversations[existing] = conv;
    }
    renderConversationList();
    await openConversation(conv.id);
  } catch (err) {
    showToast('Failed to start chat', 'error');
  }
}

// ════════════════════════════════════════════════
//  GROUP CREATION
// ════════════════════════════════════════════════
function openNewGroupModal() {
  selectedGroupMembers = [];
  document.getElementById('new-group-modal').classList.remove('hidden');
  document.getElementById('group-name').value = '';
  document.getElementById('group-desc').value = '';
  document.getElementById('group-member-search').value = '';
  document.getElementById('group-member-results').innerHTML = '';
  document.getElementById('selected-members').innerHTML = '';
  document.getElementById('group-error').textContent = '';
}

let groupSearchTimer;
function searchGroupMembers() {
  clearTimeout(groupSearchTimer);
  const q = document.getElementById('group-member-search').value.trim();
  if (!q) { document.getElementById('group-member-results').innerHTML = ''; return; }

  groupSearchTimer = setTimeout(async () => {
    try {
      const param = q.toUpperCase().startsWith('USR-') ? `unique_id=${encodeURIComponent(q)}` : `username=${encodeURIComponent(q)}`;
      const results = await apiFetch(`/api/users/search?${param}`);
      renderUserResults(results.filter(u => !selectedGroupMembers.find(m => m.id === u.id)),
        'group-member-results', (user) => addGroupMember(user), 'Add');
    } catch (err) {}
  }, 300);
}

function addGroupMember(user) {
  if (selectedGroupMembers.find(m => m.id === user.id)) return;
  selectedGroupMembers.push(user);
  renderSelectedMembers();
  document.getElementById('group-member-search').value = '';
  document.getElementById('group-member-results').innerHTML = '';
}

function removeGroupMember(userId) {
  selectedGroupMembers = selectedGroupMembers.filter(m => m.id !== userId);
  renderSelectedMembers();
}

function renderSelectedMembers() {
  const el = document.getElementById('selected-members');
  el.innerHTML = selectedGroupMembers.map(m => `
    <div class="selected-chip">
      ${escapeHtml(m.username)}
      <button onclick="removeGroupMember('${m.id}')">✕</button>
    </div>`).join('');
}

async function createGroup() {
  const name = document.getElementById('group-name').value.trim();
  const description = document.getElementById('group-desc').value.trim();
  const errEl = document.getElementById('group-error');

  if (!name) { errEl.textContent = 'Group name is required'; return; }

  try {
    const conv = await apiFetch('/api/conversations/group', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        member_ids: selectedGroupMembers.map(m => m.id)
      })
    });
    conversations.unshift(conv);
    renderConversationList();
    closeModal('new-group-modal');
    await openConversation(conv.id);
    showToast(`Group "${name}" created!`, 'success');
  } catch (err) {
    errEl.textContent = 'Failed to create group';
  }
}

// ════════════════════════════════════════════════
//  MEMBERS PANEL
// ════════════════════════════════════════════════
function openMembersPanel() {
  if (!activeConv) return;
  const panel = document.getElementById('members-panel');
  panel.classList.remove('hidden');

  const list = document.getElementById('members-list');
  const members = activeConv.members || [];

  list.innerHTML = members.map(m => {
    const u = m.users;
    const isMe = u?.id === currentUser.id;
    const canRemove = activeConv.my_role === 'admin' && !isMe;
    return `
      <div class="member-item">
        <div class="avatar sm" style="position:relative">
          ${u?.username?.[0]?.toUpperCase() || '?'}
          <div class="status-dot ${u?.status || 'offline'}" style="position:absolute;bottom:-1px;right:-1px;border-color:var(--bg-secondary)"></div>
        </div>
        <div class="member-info">
          <div class="member-name">${escapeHtml(u?.username || 'Unknown')}${isMe ? ' (You)' : ''}</div>
          <div class="member-uid">${escapeHtml(u?.unique_id || '')}</div>
        </div>
        ${m.role === 'admin' ? `<span class="member-badge admin">ADMIN</span>` : ''}
        ${canRemove ? `<button class="member-remove-btn" onclick="removeMember('${u.id}', '${escapeHtml(u.username || '')}')">✕</button>` : ''}
      </div>`;
  }).join('');

  const actions = document.getElementById('panel-actions');
  let actionsHtml = '';
  if (activeConv.type === 'group') {
    if (activeConv.my_role === 'admin') {
      actionsHtml += `<button class="panel-btn" onclick="openAddMemberModal()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        Add Member
      </button>`;
    }
    actionsHtml += `<button class="panel-btn danger" onclick="leaveGroup()">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
      Leave Group
    </button>`;
  }
  actions.innerHTML = actionsHtml;
}

function closeMembersPanel() {
  document.getElementById('members-panel').classList.add('hidden');
}

async function removeMember(userId, username) {
  if (!confirm(`Remove ${username} from the group?`)) return;
  try {
    await apiFetch(`/api/conversations/${activeConvId}/members/${userId}`, { method: 'DELETE' });
    activeConv = await apiFetch(`/api/conversations/${activeConvId}`);
    const idx = conversations.findIndex(c => c.id === activeConvId);
    if (idx !== -1) conversations[idx] = activeConv;
    openMembersPanel();
    showToast(`${username} removed`, 'success');
  } catch (err) {
    showToast('Failed to remove member', 'error');
  }
}

async function leaveGroup() {
  if (!confirm('Leave this group?')) return;
  try {
    await apiFetch(`/api/conversations/${activeConvId}/members/${currentUser.id}`, { method: 'DELETE' });
    conversations = conversations.filter(c => c.id !== activeConvId);
    activeConvId = null;
    activeConv = null;
    renderConversationList();
    document.getElementById('chat-view').classList.add('hidden');
    document.getElementById('chat-empty').classList.remove('hidden');
    closeMembersPanel();
    showToast('Left the group', '');
  } catch (err) {
    showToast('Failed to leave group', 'error');
  }
}

function openAddMemberModal() {
  document.getElementById('add-member-modal').classList.remove('hidden');
  document.getElementById('add-member-search').value = '';
  document.getElementById('add-member-results').innerHTML = '';
}

let addMemberTimer;
function searchAddMember() {
  clearTimeout(addMemberTimer);
  const q = document.getElementById('add-member-search').value.trim();
  if (!q) return;

  addMemberTimer = setTimeout(async () => {
    try {
      const param = q.toUpperCase().startsWith('USR-') ? `unique_id=${encodeURIComponent(q)}` : `username=${encodeURIComponent(q)}`;
      const results = await apiFetch(`/api/users/search?${param}`);
      const existingIds = new Set((activeConv.members || []).map(m => m.user_id));
      const filtered = results.filter(u => !existingIds.has(u.id));
      renderUserResults(filtered, 'add-member-results', (user) => addMemberToGroup(user), 'Add');
    } catch (err) {}
  }, 300);
}

async function addMemberToGroup(user) {
  try {
    await apiFetch(`/api/conversations/${activeConvId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id })
    });
    activeConv = await apiFetch(`/api/conversations/${activeConvId}`);
    const idx = conversations.findIndex(c => c.id === activeConvId);
    if (idx !== -1) conversations[idx] = activeConv;
    closeModal('add-member-modal');
    openMembersPanel();
    showToast(`${user.username} added to group`, 'success');
  } catch (err) {
    showToast('Failed to add member', 'error');
  }
}

// ════════════════════════════════════════════════
//  EMOJI PICKER
// ════════════════════════════════════════════════
function buildEmojiPicker() {
  const picker = document.getElementById('emoji-picker');
  const categories = Object.keys(EMOJI_CATEGORIES);
  let activeCat = categories[0];

  function renderCategory(cat) {
    const emojis = EMOJI_CATEGORIES[cat];
    picker.querySelector('.emoji-grid').innerHTML = emojis.map(e =>
      `<button class="emoji-btn" onclick="insertEmoji('${e}')">${e}</button>`
    ).join('');
    picker.querySelectorAll('.emoji-cat-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === cat);
    });
    activeCat = cat;
  }

  picker.innerHTML = `
    <div class="emoji-categories">
      ${categories.map(cat => `<button class="emoji-cat-btn ${cat === activeCat ? 'active' : ''}" data-cat="${cat}" onclick="renderEmojiCat('${cat}')">${cat}</button>`).join('')}
    </div>
    <div class="emoji-grid"></div>`;

  window.renderEmojiCat = (cat) => renderCategory(cat);
  renderCategory(activeCat);
}

function toggleEmojiPicker() {
  document.getElementById('emoji-picker').classList.toggle('hidden');
}

function insertEmoji(emoji) {
  const input = document.getElementById('message-input');
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const val = input.value;
  input.value = val.slice(0, start) + emoji + val.slice(end);
  input.selectionStart = input.selectionEnd = start + emoji.length;
  input.focus();
  autoResizeTextarea(input);
}

// ════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scrollToBottom() {
  const area = document.getElementById('messages-area');
  area.scrollTop = area.scrollHeight;
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function setButtonLoading(btn, loading) {
  const span = btn.querySelector('span');
  const loader = btn.querySelector('.btn-loader');
  if (loading) {
    if (span) span.style.display = 'none';
    if (loader) loader.classList.remove('hidden');
    btn.disabled = true;
  } else {
    if (span) span.style.display = '';
    if (loader) loader.classList.add('hidden');
    btn.disabled = false;
  }
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

let toastTimer;
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Expose globally for onclick handlers
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.openNewChatModal = openNewChatModal;
window.openNewGroupModal = openNewGroupModal;
window.closeModal = closeModal;
window.searchUsers = searchUsers;
window.searchGroupMembers = searchGroupMembers;
window.removeGroupMember = removeGroupMember;
window.createGroup = createGroup;
window.filterConversations = filterConversations;
window.openConversation = openConversation;
window.sendMessage = sendMessage;
window.deleteMessage = deleteMessage;
window.handleFileUpload = handleFileUpload;
window.toggleEmojiPicker = toggleEmojiPicker;
window.insertEmoji = insertEmoji;
window.handleInputKeydown = handleInputKeydown;
window.handleInputChange = handleInputChange;
window.openMembersPanel = openMembersPanel;
window.closeMembersPanel = closeMembersPanel;
window.removeMember = removeMember;
window.leaveGroup = leaveGroup;
window.openAddMemberModal = openAddMemberModal;
window.searchAddMember = searchAddMember;
window.togglePassword = togglePassword;
