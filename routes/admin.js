const express = require('express');
const Settings = require('../models/Settings');
const { requireAdmin } = require('./adminAuth');
const { runEmptyTeeReminders } = require('../utils/reminders');

const router = express.Router();

// Settings: get
router.get('/settings', requireAdmin, async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  res.json(settings);
});

// Settings: update
router.put('/settings', requireAdmin, async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  settings.globalNotificationsEnabled =
    req.body.globalNotificationsEnabled ?? settings.globalNotificationsEnabled;
  settings.dailyReminderHour =
    req.body.dailyReminderHour ?? settings.dailyReminderHour;
  await settings.save();
  res.json(settings);
});

// Trigger empty tee reminders
router.post('/reminders/empty-tee-times', requireAdmin, async (req, res) => {
  try {
    const { groupId } = req.body || {};
    const result = await runEmptyTeeReminders(groupId || null);
    res.json(result);
  } catch (err) {
    console.error('Error running reminders:', err);
    res.status(500).json({ error: 'Failed to run reminders' });
  }
});

module.exports = router;
