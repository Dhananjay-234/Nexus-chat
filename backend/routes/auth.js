// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');

const router = express.Router();

// Generate a unique user ID like USR-XXXXXX
function generateUniqueId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'USR-';
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields required' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Check if email or username already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .limit(1);

    if (existing && existing.length > 0)
      return res.status(409).json({ error: 'Email or username already taken' });

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Generate unique user ID (ensure uniqueness)
    let unique_id;
    let isUnique = false;
    while (!isUnique) {
      unique_id = generateUniqueId();
      const { data: exists } = await supabase
        .from('users')
        .select('id')
        .eq('unique_id', unique_id)
        .limit(1);
      if (!exists || exists.length === 0) isUnique = true;
    }

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({ unique_id, username, email, password_hash })
      .select('id, unique_id, username, email, avatar_url, status, created_at')
      .single();

    if (error) throw error;

    const token = jwt.sign(
      { id: user.id, username: user.username, unique_id: user.unique_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user)
      return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    // Update status to online
    await supabase.from('users').update({ status: 'online', last_seen: new Date().toISOString() }).eq('id', user.id);

    const token = jwt.sign(
      { id: user.id, username: user.username, unique_id: user.unique_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...safeUser } = user;
    safeUser.status = 'online';
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await supabase.from('users').update({ status: 'offline', last_seen: new Date().toISOString() }).eq('id', decoded.id);
    }
    res.json({ message: 'Logged out' });
  } catch (_) {
    res.json({ message: 'Logged out' });
  }
});

module.exports = router;
