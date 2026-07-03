const protect = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

// 6-char uppercase alphanumeric code, e.g. "K3F9QZ" — retried on collision.
const genTeamCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
async function makeUniqueTeamCode() {
  for (let i = 0; i < 10; i++) {
    const code = genTeamCode();
    if (!(await Team.exists({ teamCode: code }))) return code;
  }
  throw new Error('Could not generate a unique team code, try again');
}

// POST /api/teams
router.post('/', protect, async (req, res) => {
  try {
    const { name, color, logo, budget, slots, room } = req.body;
    const teamCode = await makeUniqueTeamCode();
    const team = await Team.create({
      name, color, logo: logo || '', budget,
      budgetLeft: budget, slots: slots || 11, room, players: [], retainedPlayers: [], teamCode
    });
    // teamCode is select:false on the schema, so surface it explicitly just
    // this once so Admin Panel can show it right after creation.
    const out = team.toObject();
    out.teamCode = teamCode;
    res.status(201).json({ success: true, data: out });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/teams/room/:roomId  (admin only — includes each team's bid-link code)
router.get('/room/:roomId', protect, async (req, res) => {
  try {
    const teams = await Team.find({ room: req.params.roomId })
      .select('+teamCode')
      .populate({ path: 'players.player', model: 'Player' })
      .populate({ path: 'retainedPlayers.player', model: 'Player' });
    res.json({ success: true, data: teams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/teams/verify/:roomId  (public — used by the team-live unlock screen)
// body: { code }  →  looks up the team in this room by its bid code.
// Never echoes the code back; only returns what the team page needs to render.
router.post('/verify/:roomId', async (req, res) => {
  try {
    const code = (req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, message: 'Enter a code' });
    const team = await Team.findOne({ room: req.params.roomId, teamCode: code });
    if (!team) return res.status(404).json({ success: false, message: 'Invalid code' });
    res.json({ success: true, data: { teamId: team._id, name: team.name, color: team.color, logo: team.logo } });
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