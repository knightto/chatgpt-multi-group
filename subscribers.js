const express = require('express');
const crypto = require('crypto');
const Subscriber = require('../models/Subscriber');
const { requireAdmin } = require('./adminAuth');

const router = express.Router({ mergeParams: true });

// Public: subscribe
router.post('/', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const token = crypto.randomBytes(16).toString('hex');

    const sub = await Subscriber.findOneAndUpdate(
      { groupId, email },
      { name, unsubscribeToken: token },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(sub);
  } catch (err) {
    console.error('Error subscribing:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Admin: list subscribers
router.get('/', requireAdmin, async (req, res) => {
  const { groupId } = req.params;
  const subs = await Subscriber.find({ groupId }).sort({ createdAt: -1 });
  res.json(subs);
});

// Admin: delete subscriber
router.delete('/:subscriberId', requireAdmin, async (req, res) => {
  try {
    const { groupId, subscriberId } = req.params;
    const sub = await Subscriber.findOneAndDelete({ _id: subscriberId, groupId });
    if (!sub) return res.status(404).json({ error: 'Subscriber not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting subscriber:', err);
    res.status(500).json({ error: 'Failed to delete subscriber' });
  }
});

module.exports = router;
