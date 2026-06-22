const protect = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

// POST /api/teams
router.post('/', protect, async (req, res) => {
  try {
    const { name, color, logo, budget, slots, room } = req.body;
    const team = await Team.create({
      name, color, logo: logo || '', budget,
      budgetLeft: budget, slots: slots || 11, room, players: [], retainedPlayers: []
    });
    res.status(201).json({ success: true, data: team });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/teams/room/:roomId
router.get('/room/:roomId', async (req, res) => {
  try {
    const teams = await Team.find({ room: req.params.roomId })
      .populate({ path: 'players.player', model: 'Player' })
      .populate({ path: 'retainedPlayers.player', model: 'Player' });
    res.json({ success: true, data: teams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/teams/:id
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate({ path: 'players.player', model: 'Player' })
      .populate({ path: 'retainedPlayers.player', model: 'Player' });
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    res.json({ success: true, data: team });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/teams/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: team });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/teams/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Team deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
