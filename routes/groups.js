const express = require('express');
const Group = require('../models/Group');
const { requireAdmin } = require('./adminAuth');

const router = express.Router();

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

    const accessCode = (name + '-' + Math.random().toString(36).slice(2, 8))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

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

// Admin: list groups
router.get('/', requireAdmin, async (req, res) => {
  const groups = await Group.find().sort({ createdAt: -1 });
  res.json(groups);
});

// Public: get a group
router.get('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const group = await Group.findOne({ _id: groupId, isActive: true });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json(group);
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

module.exports = router;
