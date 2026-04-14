# NEXUS Chat — Real-time Chat Application

A full-featured real-time chat app with WebSocket, Supabase backend, and a polished dark UI.

---

## 🚀 Features

### Core Functionality
- **🔐 User Authentication** — Secure register, login, and logout with JWT tokens
- **🆔 Unique User IDs** — Format: `USR-XXXXXX` — search by ID to start a chat
- **💬 Direct Messaging** — One-to-one real-time conversations
- **👥 Group Chats** — Create and manage group conversations
- **👑 Admin Controls** — Delete messages, add/remove members, manage groups
- **😀 Emoji Picker** — 7 categories of emojis for expressive chat
- **📎 File & Image Sharing** — Share files via Supabase Storage
- **⚡ Real-time WebSocket** — Typing indicators, message delivery, online status
- **🟢 Presence Indicators** — Online/offline status with last seen timestamps

---

## 📁 Project Structure

```
chatapp/
├── backend/
│   ├── .env                  ← YOUR KEYS GO HERE
│   ├── server.js             ← Express + HTTP server entry
│   ├── supabase.js           ← Supabase client
│   ├── websocket.js          ← WS server + broadcast helpers
│   ├── schema.sql            ← Run this in Supabase SQL Editor
│   ├── middleware/
│   │   └── auth.js           ← JWT middleware
│   └── routes/
│       ├── auth.js           ← /api/auth/*
│       ├── users.js          ← /api/users/*
│       ├── conversations.js  ← /api/conversations/*
│       └── messages.js       ← /api/messages/*
└── frontend/
    └── public/
        ├── index.html        ← Main HTML entry
        ├── css/style.css     ← Styles
        └── js/app.js         ← Frontend logic
```

---

## 🛠️ Setup Instructions

### Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) → your project
2. Open **SQL Editor** → paste and run `backend/schema.sql`
3. Go to **Storage** → create a new bucket named **`chat-files`** → set to **Public**
4. Go to **Settings → API** → copy:
   - `URL`
   - `anon public` key
   - `service_role` key (for backend)

### Step 2: Configure `.env`

Edit `backend/.env`:

```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_public_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
JWT_SECRET=change_this_to_a_long_random_string
PORT=3000
```

> ⚠️ **Never commit `.env` to git.** The `service_role` key has full DB access.

### Step 3: Install & Run

```bash
cd backend
npm install
npm start
```

Then open: **http://localhost:3000**

For development with auto-restart:
```bash
npm run dev   # requires: npm install -g nodemon
```

---

## 📡 API Reference

### Authentication Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |

**Request Body Examples:**

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "securePassword123"
}
```

---

### User Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user |
| GET | `/api/users/search?unique_id=USR-XXXXX` | Search by unique ID |
| GET | `/api/users/search?username=alice` | Search by username |
| GET | `/api/users/:id` | Get user by ID |

**Response Example:**

```json
{
  "id": "uuid-here",
  "unique_id": "USR-ABC123",
  "username": "alice",
  "email": "alice@example.com",
  "avatar_url": "https://...",
  "status": "online",
  "last_seen": "2025-04-14T10:30:00Z"
}
```

---

### Conversation Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | Get all conversations |
| POST | `/api/conversations/direct` | Start direct chat |
| POST | `/api/conversations/group` | Create group |
| GET | `/api/conversations/:id` | Get conversation details |
| POST | `/api/conversations/:id/members` | Add member (admin only) |
| DELETE | `/api/conversations/:id/members/:userId` | Remove member / leave |

**Create Direct Chat:**

```json
{
  "target_user_id": "uuid-of-target-user"
}
```

**Create Group:**

```json
{
  "name": "Project Team",
  "description": "Discussing Q2 roadmap",
  "member_ids": ["uuid1", "uuid2", "uuid3"]
}
```

---

### Message Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/:convId` | Get messages (supports pagination) |
| POST | `/api/messages/:convId` | Send text message |
| POST | `/api/messages/:convId/upload` | Upload file/image |
| DELETE | `/api/messages/:msgId` | Delete message |

**Send Text Message:**

```json
{
  "content": "Hello everyone!",
  "type": "text"
}
```

**Upload File:**

```
Content-Type: multipart/form-data
Field: file (binary)
```

---

## 🔌 WebSocket Events

**Connect to:** `ws://localhost:3000/ws?token=YOUR_JWT_TOKEN`

### Client → Server

```json
{ "type": "join_conversation", "conversationId": "uuid" }
{ "type": "leave_conversation", "conversationId": "uuid" }
{ "type": "typing", "conversationId": "uuid", "isTyping": true }
{ "type": "ping" }
```

### Server → Client

```json
{ "type": "connected", "userId": "...", "username": "..." }
{ "type": "new_message", "message": { /* message object */ } }
{ "type": "message_deleted", "messageId": "...", "conversationId": "..." }
{ "type": "typing", "userId": "...", "username": "...", "isTyping": true }
{ "type": "user_status", "userId": "...", "status": "online|offline" }
{ "type": "user_joined_view", "userId": "...", "username": "..." }
{ "type": "error", "message": "..." }
```

---

## 💾 Database Schema

### Users Table
```sql
- id (UUID, primary key)
- unique_id (VARCHAR, unique) — e.g., USR-ABC123
- username (VARCHAR, unique)
- email (VARCHAR, unique)
- password_hash (TEXT)
- avatar_url (TEXT)
- status (VARCHAR) — online | offline | away
- last_seen (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
```

### Conversations Table
```sql
- id (UUID, primary key)
- type (VARCHAR) — direct | group
- name (VARCHAR) — for groups only
- description (TEXT) — for groups only
- avatar_url (TEXT) — group avatar
- created_by (UUID, foreign key)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### Conversation Members Table
```sql
- id (UUID, primary key)
- conversation_id (UUID, foreign key)
- user_id (UUID, foreign key)
- role (VARCHAR) — admin | member
- joined_at (TIMESTAMPTZ)
- UNIQUE(conversation_id, user_id)
```

### Messages Table
```sql
- id (UUID, primary key)
- conversation_id (UUID, foreign key)
- sender_id (UUID, foreign key)
- content (TEXT)
- type (VARCHAR) — text | image | file | emoji
- file_url (TEXT)
- file_name (TEXT)
- file_size (INTEGER)
- file_type (TEXT)
- is_deleted (BOOLEAN) — soft delete
- deleted_by (UUID, foreign key)
- deleted_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
```

---

## 🛡️ Security Considerations

### Password Hashing
Passwords are hashed using **bcryptjs** with salt rounds of 12, ensuring strong security.

### JWT Tokens
- Tokens expire after **7 days**
- Signature verified on every protected request
- Stored in browser (client-side)

### Service Role Key
The `service_role` key in `.env` bypasses Row Level Security. **Keep it strictly server-side.** Never expose it to the frontend.

### File Upload Security
- File type validation (MIME type checking)
- 25MB file size limit
- Supabase Storage handles secure public URL generation

### Soft Deletes
Messages are soft-deleted (marked as deleted) rather than hard-deleted, allowing audit trails and potential recovery.

---

## 🚀 Deployment Checklist

- [ ] Set `SUPABASE_URL`, keys, and `JWT_SECRET` in production environment
- [ ] Update CORS to accept only your frontend domain
- [ ] Create Supabase backups regularly
- [ ] Enable HTTPS/TLS for all connections
- [ ] Monitor WebSocket connections for memory leaks
- [ ] Set up error logging and monitoring
- [ ] Test file upload with large files
- [ ] Verify Row Level Security policies in production

---

## 📦 Dependencies

### Backend
```
@supabase/supabase-js: ^2.39.0   — Supabase SDK
bcryptjs: ^2.4.3                  — Password hashing
cors: ^2.8.5                      — Cross-origin requests
dotenv: ^16.3.1                   — Environment variables
express: ^4.18.2                  — Web framework
jsonwebtoken: ^9.0.2              — JWT handling
multer: ^1.4.5-lts.1              — File uploads
uuid: ^9.0.0                       — UUID generation
ws: ^8.16.0                       — WebSocket server
```

### Development
```
nodemon: ^3.0.2                   — Auto-restart on changes
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is open source and available under the MIT License.

---

## 🆘 Troubleshooting

### "chat-files bucket not found"
- Create a storage bucket named `chat-files` in Supabase
- Ensure it's set to **Public**

### "Invalid token" error
- JWT token may have expired (expires after 7 days)
- Clear local storage and login again

### WebSocket connection fails
- Verify the backend is running on `http://localhost:3000`
- Check that port 3000 is not blocked by a firewall
- Ensure the JWT token is valid

### Queries are slow
- Check Supabase indexes (especially on `messages`, `conversation_members`)
- Consider adding pagination limits to message fetches

---

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review Supabase docs: [supabase.com/docs](https://supabase.com/docs)

---

