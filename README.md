NEXUS Chat — Real-Time Messaging Platform

NEXUS Chat is a modern real-time messaging platform designed for instant communication between users through direct chats and group conversations. The application combines a responsive dark-themed interface with real-time WebSocket communication and a scalable backend powered by Supabase.

--------------------------------------------------

PROJECT OVERVIEW

The project focuses on delivering a complete chat experience similar to modern messaging applications. Users can register securely, search for other users using unique IDs, exchange messages instantly, share files, and participate in group conversations.

The system is built using a client-server architecture where:

- The frontend handles the user interface and chat interactions.
- The backend manages authentication, APIs, WebSocket communication, and database operations.
- Supabase provides database storage, authentication support, and file storage services.
- WebSocket technology enables real-time updates such as live messages, typing indicators, and online status changes.

--------------------------------------------------

MAIN FEATURES

1. User Authentication

The application includes a secure authentication system where users can:

- Register new accounts
- Login/logout securely
- Access protected chat features using JWT authentication

Passwords are encrypted using bcrypt hashing for better security.

--------------------------------------------------

2. Unique User Identification

Each user receives a unique ID in the format:

USR-XXXXXX

This ID allows users to search and start conversations easily without sharing personal information publicly.

--------------------------------------------------

3. Direct Messaging System

The platform supports one-to-one private conversations where users can:

- Send instant messages
- Receive messages in real time
- View online/offline user status
- See typing indicators during conversations

Communication occurs through persistent WebSocket connections for minimal delay.

--------------------------------------------------

4. Group Chat Functionality

Users can create and manage group conversations with multiple participants.

Group features include:

- Group creation
- Member management
- Admin controls
- Group descriptions and avatars
- Real-time group messaging

Admins have permission to add/remove users and manage conversations.

--------------------------------------------------

5. Emoji Support

The system contains an emoji picker with multiple categories that allows users to express reactions and emotions naturally during chats.

--------------------------------------------------

6. File & Image Sharing

Users can upload and share:

- Images
- Documents
- Other files

Files are stored using Supabase Storage, and secure public URLs are generated automatically for access and sharing.

--------------------------------------------------

7. Real-Time Communication

Real-time functionality is implemented using WebSocket technology.

The application supports:

- Instant message delivery
- Typing notifications
- Online/offline presence
- Live updates without page refresh

This creates a smooth and interactive messaging experience.

--------------------------------------------------

SYSTEM ARCHITECTURE

The project follows a modular full-stack architecture divided into frontend and backend sections.

Frontend

The frontend is responsible for:

- User interface rendering
- Chat screens
- Real-time updates
- API communication
- User interaction handling

Technologies used:

- HTML
- CSS
- JavaScript

--------------------------------------------------

Backend

The backend handles:

- Authentication
- API routing
- Database operations
- File uploads
- WebSocket server management

Technologies used:

- Node.js
- Express.js
- WebSocket (ws)
- JWT Authentication

--------------------------------------------------

Database & Storage

Supabase is used for:

- PostgreSQL database management
- User data storage
- Conversation storage
- Message history
- File storage system

--------------------------------------------------

DATABASE DESIGN

The system uses multiple relational tables for efficient data management.

1. Users Table

Stores:

- User information
- Unique IDs
- Email addresses
- Password hashes
- Online status
- Last seen timestamps

--------------------------------------------------

2. Conversations Table

Stores:

- Conversation details
- Chat type (direct/group)
- Group metadata
- Creation timestamps

--------------------------------------------------

3. Conversation Members Table

Manages:

- Group participants
- Member roles
- Admin permissions
- Membership relationships

--------------------------------------------------

4. Messages Table

Stores:

- Text messages
- File messages
- Sender details
- Timestamps
- Message status
- Soft delete information

--------------------------------------------------

SECURITY FEATURES

The application includes several security mechanisms:

1. Password Protection

Passwords are hashed using bcrypt with salting to prevent password leaks.

--------------------------------------------------

2. JWT Authentication

Protected APIs require valid JWT tokens for access.

--------------------------------------------------

3. Secure File Uploads

Uploaded files are validated before storage.

--------------------------------------------------

4. Soft Delete System

Deleted messages are not removed permanently from the database, allowing audit tracking and recovery.

--------------------------------------------------

5. Protected Backend Keys

Sensitive database keys remain server-side only.

--------------------------------------------------

API MODULES

The backend is divided into several API modules:

- Authentication API
  Handles user registration and login.

- User API
  Handles user search and profile management.

- Conversation API
  Handles chat and group management.

- Message API
  Handles sending, retrieving, and deleting messages.

--------------------------------------------------

WEBSOCKET COMMUNICATION

WebSocket events are used for real-time synchronization between users.

Client Actions:
- Join conversation
- Leave conversation
- Send typing status
- Maintain active connection

Server Responses:
- Deliver new messages
- Broadcast typing indicators
- Update online status
- Notify deleted messages

--------------------------------------------------

TECHNOLOGIES USED

Backend Technologies:
- Node.js
- Express.js
- WebSocket (ws)
- JWT
- bcryptjs
- Multer

Frontend Technologies:
- HTML
- CSS
- JavaScript

Database & Cloud Services:
- Supabase
- PostgreSQL
- Supabase Storage

--------------------------------------------------

ADVANTAGES OF THE PROJECT

- Real-time communication
- Secure authentication system
- Modern user interface
- Scalable architecture
- Group collaboration support
- File sharing capability
- Fast message delivery
- Modular backend structure

--------------------------------------------------

CONCLUSION

NEXUS Chat is a complete real-time communication platform built using modern web technologies. The project demonstrates implementation of authentication, WebSocket-based messaging, database management, file sharing, and scalable backend architecture in a single application. It provides users with a smooth and interactive chat experience while maintaining security, scalability, and efficient real-time communication.