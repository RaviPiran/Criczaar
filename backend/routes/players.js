const protect = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const Player = require('../models/Player');

// POST /api/players
router.post('/', protect, async (req, res) => {
  try {
    const player = await Player.create(req.body);
    res.status(201).json({ success: true, data: player });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/players/bulk
router.post('/bulk', protect, async (req, res) => {
  try {
    const { players } = req.body;
    const created = await Player.insertMany(players);
    res.status(201).json({ success: true, data: created, count: created.length });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/players/room/:roomId
router.get('/room/:roomId', async (req, res) => {
  try {
    const { status, role } = req.query;
    const filter = { room: req.params.roomId };
    if (status) filter.status = status;
    if (role) filter.role = role;
    const players = await Player.find(filter)
      .populate('soldTo', 'name color logo')
      .populate('retainedBy', 'name color logo')
      .sort({ auctionOrder: 1, createdAt: 1 });
    res.json({ success: true, data: players, count: players.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/players/:id
router.get('/:id', async (req, res) => {
  try {
    const player = await Player.findById(req.params.id)
      .populate('soldTo', 'name color logo')
      .populate('retainedBy', 'name color logo');
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });
    res.json({ success: true, data: player });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/players/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: player });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/players/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    await Player.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Player deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
