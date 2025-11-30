const express = require('express');
const Event = require('../models/Event');
const { requireAdmin } = require('./adminAuth');

const router = express.Router({ mergeParams: true });

// List events for a group (upcoming)
router.get('/', async (req, res) => {
  const { groupId } = req.params;
  const now = new Date();
  const events = await Event.find({ groupId, date: { $gte: now } }).sort({
    date: 1
  });
  res.json(events);
});

// Admin: create event
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, date, type, teamSize, startType } = req.body;
    if (!name || !date) {
      return res.status(400).json({ error: 'name and date are required' });
    }

    const event = await Event.create({
      groupId,
      name,
      description,
      date,
      type: type || 'teeTime',
      teamSize: teamSize || 4,
      startType: startType || 'straight'
    });

    res.status(201).json(event);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Admin: update event
router.put('/:eventId', requireAdmin, async (req, res) => {
  try {
    const { groupId, eventId } = req.params;
    const event = await Event.findOneAndUpdate(
      { _id: eventId, groupId },
      req.body,
      { new: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Admin: delete event
router.delete('/:eventId', requireAdmin, async (req, res) => {
  try {
    const { groupId, eventId } = req.params;
    const event = await Event.findOneAndDelete({ _id: eventId, groupId });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Admin: auto-generate tee times
router.post('/:eventId/tee-times/auto', requireAdmin, async (req, res) => {
  try {
    const { groupId, eventId } = req.params;
    const { startTime, intervalMinutes, count, capacity } = req.body;

    if (!startTime || !intervalMinutes || !count) {
      return res
        .status(400)
        .json({ error: 'startTime, intervalMinutes, count required' });
    }

    const event = await Event.findOne({ _id: eventId, groupId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const [startHour, startMin] = String(startTime)
      .split(':')
      .map((v) => parseInt(v, 10));

    const teeTimes = [];
    let currentMinutes = startHour * 60 + startMin;
    for (let i = 0; i < count; i++) {
      const hh = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
      const mm = String(currentMinutes % 60).padStart(2, '0');
      teeTimes.push({
        time: `${hh}:${mm}`,
        capacity: capacity || 4,
        players: []
      });
      currentMinutes += parseInt(intervalMinutes, 10);
    }

    event.teeTimes.push(...teeTimes);
    await event.save();
    res.json(event);
  } catch (err) {
    console.error('Error auto-generating tee times:', err);
    res.status(500).json({ error: 'Failed to auto-generate tee times' });
  }
});

// Admin: add single tee time
router.post('/:eventId/tee-times', requireAdmin, async (req, res) => {
  try {
    const { groupId, eventId } = req.params;
    const { time, capacity } = req.body;
    if (!time) return res.status(400).json({ error: 'time required' });

    const event = await Event.findOne({ _id: eventId, groupId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    event.teeTimes.push({
      time,
      capacity: capacity || 4,
      players: []
    });

    await event.save();
    res.json(event);
  } catch (err) {
    console.error('Error adding tee time:', err);
    res.status(500).json({ error: 'Failed to add tee time' });
  }
});

// Public: sign up for tee time
router.post('/:eventId/tee-times/:teeTimeId/players', async (req, res) => {
  try {
    const { groupId, eventId, teeTimeId } = req.params;
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email required' });
    }

    const event = await Event.findOne({ _id: eventId, groupId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const tt = event.teeTimes.id(teeTimeId);
    if (!tt) return res.status(404).json({ error: 'Tee time not found' });

    const currentCount = tt.players.length;
    const cap = tt.capacity || 4;
    if (currentCount >= cap) {
      return res.status(400).json({ error: 'Tee time is full' });
    }

    tt.players.push({ name, email });
    await event.save();
    res.json(event);
  } catch (err) {
    console.error('Error signing up for tee time:', err);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

// Public/Admin: remove player from tee time
router.delete('/:eventId/tee-times/:teeTimeId/players/:playerId', async (req, res) => {
  try {
    const { groupId, eventId, teeTimeId, playerId } = req.params;
    const event = await Event.findOne({ _id: eventId, groupId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const tt = event.teeTimes.id(teeTimeId);
    if (!tt) return res.status(404).json({ error: 'Tee time not found' });

    const player = tt.players.id(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    player.remove();
    await event.save();
    res.json(event);
  } catch (err) {
    console.error('Error removing player:', err);
    res.status(500).json({ error: 'Failed to remove player' });
  }
});

// Admin: move player between tee times
router.post('/:eventId/move-player', requireAdmin, async (req, res) => {
  try {
    const { groupId, eventId } = req.params;
    const { fromTeeTimeId, toTeeTimeId, playerId } = req.body;

    const event = await Event.findOne({ _id: eventId, groupId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const from = event.teeTimes.id(fromTeeTimeId);
    const to = event.teeTimes.id(toTeeTimeId);
    if (!from || !to) {
      return res.status(404).json({ error: 'Source or destination tee time not found' });
    }

    const player = from.players.id(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found in source tee time' });

    const cap = to.capacity || 4;
    if (to.players.length >= cap) {
      return res.status(400).json({ error: 'Destination tee time is full' });
    }

    from.players.id(playerId).remove();
    to.players.push(player.toObject());
    await event.save();

    res.json(event);
  } catch (err) {
    console.error('Error moving player:', err);
    res.status(500).json({ error: 'Failed to move player' });
  }
});

module.exports = router;
