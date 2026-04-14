// backend/routes/users.js
const express = require('express');
const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/users/me - Get current user profile
router.get('/me', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, unique_id, username, email, avatar_url, status, last_seen, created_at')
      .eq('id', req.user.id)
      .single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/search?unique_id=USR-XXXXX  — find by unique ID
router.get('/search', async (req, res) => {
  try {
    const { unique_id, username } = req.query;
    let query = supabase
      .from('users')
      .select('id, unique_id, username, avatar_url, status, last_seen');

    if (unique_id) {
      query = query.ilike('unique_id', `%${unique_id}%`);
    } else if (username) {
      query = query.ilike('username', `%${username}%`);
    } else {
      return res.status(400).json({ error: 'Provide unique_id or username query' });
    }

    const { data, error } = await query.neq('id', req.user.id).limit(10);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, unique_id, username, avatar_url, status, last_seen')
      .eq('id', req.params.id)
      .single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
