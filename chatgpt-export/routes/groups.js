// ...existing code...
// Admin: create group with default structure/data (template)
router.post('/with-data', requireAdmin, async (req, res) => {
  try {
    const { name, description, template, logoUrl } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    function makeCodeFromName() {
      const raw =
        name.toString().toLowerCase() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 8);
      return raw.replace(/[^a-z0-9]+/g, '');
    }

    let accessCode = makeCodeFromName();
    while (true) {
      const exists = await Group.exists({ accessCode });
      if (!exists) break;
      accessCode = makeCodeFromName();
    }

    // Create the group
    const group = await Group.create({
      name,
      description,
      template: template || 'golf',
      logoUrl,
      accessCode
    });

    // Create a sample event and tee times for this group
    const EventModel = require('../models/Event');
    const now = new Date();
    const event = await EventModel.create({
      groupId: group._id,
      name: 'Sample Event',
      description: 'This is a sample event created with the group.',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 12, 0, 0),
      type: 'teeTime',
      teamSize: 4,
      startType: 'straight',
      teeTimes: [
        { time: '07:00', capacity: 4, players: [] },
        { time: '07:09', capacity: 4, players: [] },
        { time: '07:18', capacity: 4, players: [] }
      ]
    });

    res.status(201).json({ group, event });
  } catch (err) {
    console.error('Error creating group with data:', err);
    res.status(500).json({ error: 'Failed to create group with data' });
  }
});
const express = require('express');
const Group = require('../models/Group');
const { requireAdmin } = require('./adminAuth');

const router = express.Router();

// Helper to ensure a group document has an accessCode.
// This also backfills codes for existing groups that were created
// before accessCode was introduced.
async function ensureAccessCode(group) {
  if (group.accessCode) return group;

  function makeCode() {
    const base = (group.name || 'group').toString().toLowerCase();
    const raw =
      base +
      '-' +
      Math.random()
        .toString(36)
        .slice(2, 8);
    return raw.replace(/[^a-z0-9]+/g, '');
  }

  let code = makeCode();
  // Make sure it is unique
  // In practice this should finish very quickly.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await Group.exists({ accessCode: code });
    if (!exists) break;
    code = makeCode();
  }

  group.accessCode = code;
  await group.save();
  return group;
}

// Resolve access code -> groupId
router.post('/resolve-access-code', async (req, res) => {
  const { accessCode } = req.body || {};
  if (!accessCode) return res.status(400).json({ error: 'accessCode required' });

  const group = await Group.findOne({ accessCode, isActive: true });
  if (!group) return res.status(404).json({ error: 'Group not found' });

  res.json({ groupId: group._id.toString(), name: group.name });
});

// Admin: create group
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description, template, logoUrl } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    function makeCodeFromName() {
      const raw =
        name.toString().toLowerCase() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 8);
      return raw.replace(/[^a-z0-9]+/g, '');
    }

    let accessCode = makeCodeFromName();
    // Ensure unique at creation time as well
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await Group.exists({ accessCode });
      if (!exists) break;
      accessCode = makeCodeFromName();
    }

    const group = await Group.create({
      name,
      description,
      template: template || 'golf',
      logoUrl,
      accessCode
    });

    res.status(201).json(group);
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Admin: list groups (also backfill any missing access codes)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const groups = await Group.find().sort({ createdAt: -1 });

    for (const g of groups) {
      if (!g.accessCode) {
        await ensureAccessCode(g);
      }
    }

    res.json(groups);
  } catch (err) {
    console.error('Error listing groups:', err);
    res.status(500).json({ error: 'Failed to list groups' });
  }
});

// Public: get a single group (and backfill accessCode if missing)
router.get('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    let group = await Group.findOne({ _id: groupId, isActive: true });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!group.accessCode) {
      group = await ensureAccessCode(group);
    }

    res.json(group);
  } catch (err) {
    console.error('Error fetching group:', err);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Admin: update group
router.put('/:groupId', requireAdmin, async (req, res) => {
  try {
    const { groupId } = req.params;
    const update = req.body || {};
    const group = await Group.findByIdAndUpdate(groupId, update, { new: true });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Admin: soft delete/archive group
router.delete('/:groupId', requireAdmin, async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findByIdAndUpdate(
      groupId,
      { isActive: false },
      { new: true }
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (err) {
    console.error('Error archiving group:', err);
    res.status(500).json({ error: 'Failed to archive group' });
  }
});

// Admin: HARD DELETE group and all related data
router.delete('/:groupId/hard', requireAdmin, async (req, res) => {
  try {
    const { groupId } = req.params;
    const GroupModel = require('../models/Group');
    const EventModel = require('../models/Event');
    const SubscriberModel = require('../models/Subscriber');

    // Remove all events for this group
    await EventModel.deleteMany({ groupId });
    // Remove all subscribers for this group
    await SubscriberModel.deleteMany({ groupId });
    // Remove the group itself
    const group = await GroupModel.findByIdAndDelete(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error hard-deleting group:', err);
    res.status(500).json({ error: 'Failed to hard-delete group' });
  }
});

module.exports = router;
