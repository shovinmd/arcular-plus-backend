const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Get user profile
router.get('/:uid', auth, async (req, res) => {
  const { uid } = req.params;
  const user = await User.findOne({ uid });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Update user profile
router.put('/:uid', auth, async (req, res) => {
  const { uid } = req.params;
  const update = req.body;
  const user = await User.findOneAndUpdate({ uid }, update, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router; 