const express  = require('express');
const router   = express.Router();
const Room     = require('../models/Room');
const Team     = require('../models/Team');
const Player   = require('../models/Player');
const jwt      = require('jsonwebtoken');
const protect  = require('../middleware/auth');

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// POST /api/rooms — BUG FIX #7: now saves owner from JWT
router.post('/', protect, async (req, res) => {
  try {
    const { name, rules, tournament, scheduledAt } = req.body;
    let code;
    do { code = generateCode(); } while (await Room.findOne({ code }));
    const room = await Room.create({
      name, code,
      owner: req.user._id,          // ← fixed: track owner
      rules: rules || {},
      tournament: tournament || {},
      scheduledAt: scheduledAt || null,
    });
    const token = jwt.sign({ roomId: room._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ success: true, data: room, token });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/rooms/user/all — BUG FIX #8: was returning ALL rooms; now filters by owner
router.get('/user/all', protect, async (req, res) => {
  try {
    // Show rooms this user owns. Fall back to all rooms for legacy data (owner==null)
    const rooms = await Room.find({
      $or: [{ owner: req.user._id }, { owner: null }]
    }).sort({ createdAt: -1 }).select('name code status createdAt tournament owner');
    res.json({ success: true, data: rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rooms/public/:id/full — PUBLIC, no auth. Used by Live Spectator page.
router.get('/public/:id/full', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('currentPlayer').populate('currentBidder');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    // FIX: legacy Team docs can have players/retainedPlayers stored as null
    // instead of []. populate() reads .length on these internally and throws
    // "Cannot read properties of undefined (reading 'length')" — normalize first.
    await Team.updateMany({ room: room._id, players: null }, { $set: { players: [] } });
    await Team.updateMany({ room: room._id, retainedPlayers: null }, { $set: { retainedPlayers: [] } });
    const teams = await Team.find({ room: room._id })
      .populate({ path: 'players.player', model: 'Player' })
      .populate({ path: 'retainedPlayers.player', model: 'Player' });
    const players = await Player.find({ room: room._id })
      .populate('soldTo', 'name color logo')
      .populate('retainedBy', 'name color logo')
      .sort({ auctionOrder: 1, createdAt: 1 });
    res.json({ success: true, data: { room, teams, players } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rooms/:id/full — PROTECTED, used by logged-in auctioneer
router.get('/:id/full', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('currentPlayer').populate('currentBidder');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    // FIX: same legacy-null normalization as the public route above.
    await Team.updateMany({ room: room._id, players: null }, { $set: { players: [] } });
    await Team.updateMany({ room: room._id, retainedPlayers: null }, { $set: { retainedPlayers: [] } });
    const teams = await Team.find({ room: room._id })
      .populate({ path: 'players.player', model: 'Player' })
      .populate({ path: 'retainedPlayers.player', model: 'Player' });
    const players = await Player.find({ room: room._id })
      .populate('soldTo', 'name color logo')
      .populate('retainedBy', 'name color logo')
      .sort({ auctionOrder: 1, createdAt: 1 });
    res.json({ success: true, data: { room, teams, players } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rooms/:code — join by code (public, for spectators)
router.get('/:code', async (req, res) => {
  try {
    const isId = req.params.code.match(/^[0-9a-fA-F]{24}$/);
    const room = isId
      ? await Room.findById(req.params.code).populate('currentPlayer').populate('currentBidder')
      : await Room.findOne({ code: req.params.code.toUpperCase() }).populate('currentPlayer').populate('currentBidder');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/rooms/:id/status
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const prev = room.status;
    room.status = status;
    if (status === 'paused' && prev === 'active')
      room.auctionLog.push({ message: '⏸ Auction paused', type: 'pause' });
    else if (status === 'active' && prev === 'paused')
      room.auctionLog.push({ message: '▶ Auction resumed', type: 'resume' });
    await room.save();
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/rooms/:id/rules
router.patch('/:id/rules', protect, async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, { rules: req.body.rules }, { new: true });
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/:id/next-player
router.post('/:id/next-player', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.status === 'paused') return res.status(400).json({ success: false, message: 'Auction is paused' });

    const { playerId } = req.body;
    let chosenPlayer;
    if (playerId) {
      chosenPlayer = await Player.findOne({ _id: playerId, room: room._id, status: 'remaining' });
      if (!chosenPlayer) return res.status(400).json({ success: false, message: 'Selected player not available' });
    } else {
      chosenPlayer = await Player.findOne({ room: room._id, status: 'remaining' })
        .sort({ auctionOrder: 1, createdAt: 1 });
    }

    if (!chosenPlayer) {
      room.currentPlayer = null;
      room.currentBid    = 0;
      room.currentBidder = null;
      await room.save();
      return res.json({ success: true, data: null, message: 'No remaining players' });
    }

    room.currentPlayer = chosenPlayer._id;
    room.currentBid    = chosenPlayer.basePrice;
    room.currentBidder = null;
    await room.save();
    res.json({ success: true, data: await room.populate('currentPlayer') });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/:id/bid
router.post('/:id/bid', protect, async (req, res) => {
  try {
    const { teamId, amount } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room || !room.currentPlayer) return res.status(400).json({ success: false, message: 'No active auction' });
    if (room.status === 'paused') return res.status(400).json({ success: false, message: 'Auction is paused' });

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    if (amount > team.budgetLeft) return res.status(400).json({ success: false, message: 'Insufficient budget' });
    if (amount <= room.currentBid)  return res.status(400).json({ success: false, message: 'Bid must be higher' });

    let bonusLabel = '';
    if (room.rules?.bidBonusRules?.length) {
      const match = room.rules.bidBonusRules.find(r => amount >= r.minBid && amount <= r.maxBid);
      if (match) bonusLabel = ` [+${match.bonusPoints} pts bonus]`;
    }

    room.currentBid    = amount;
    room.currentBidder = teamId;
    room.auctionLog.push({ message: `${team.name} bids ${amount} pts${bonusLabel}`, type: 'bid' });
    await room.save();
    res.json({ success: true, data: { currentBid: amount, currentBidder: team } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/:id/sell
router.post('/:id/sell', protect, async (req, res) => {
  try {
    const { teamId, price } = req.body;
    const room = await Room.findById(req.params.id).populate('currentPlayer');
    if (!room || !room.currentPlayer) return res.status(400).json({ success: false, message: 'No active player' });

    const player = room.currentPlayer;
    const team   = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    if (price > team.budgetLeft)    return res.status(400).json({ success: false, message: 'Insufficient budget' });
    if (team.players.length >= team.slots) return res.status(400).json({ success: false, message: 'Team roster full' });

    let bonusPoints = 0;
    if (room.rules?.bidBonusRules) {
      const match = room.rules.bidBonusRules.find(r => price >= r.minBid && price <= r.maxBid);
      if (match) bonusPoints = match.bonusPoints;
    }

    await Player.findByIdAndUpdate(player._id, { status: 'sold', soldTo: teamId, soldPrice: price });
    team.players = team.players || [];
    team.players.push({ player: player._id, soldPrice: price, isRetained: false });
    team.budgetLeft = Math.round((team.budgetLeft - price) * 10) / 10;
    await team.save();

    const bonusMsg = bonusPoints > 0 ? ` (+${bonusPoints} pts bonus)` : '';
    room.auctionLog.push({ message: `✅ ${player.name} → ${team.name} @ ${price} pts${bonusMsg}`, type: 'sold' });
    room.currentPlayer = null;
    room.currentBid    = 0;
    room.currentBidder = null;
    await room.save();

    res.json({ success: true, data: { player, team, price, bonusPoints } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/:id/unsold
router.post('/:id/unsold', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate('currentPlayer');
    if (!room || !room.currentPlayer) return res.status(400).json({ success: false, message: 'No active player' });

    const player = room.currentPlayer;
    await Player.findByIdAndUpdate(player._id, { status: 'unsold' });
    room.auctionLog.push({ message: `❌ ${player.name} — UNSOLD`, type: 'unsold' });
    room.currentPlayer = null;
    room.currentBid    = 0;
    room.currentBidder = null;
    await room.save();
    res.json({ success: true, data: player });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/:id/retain — BUG FIX #9: guard against double-retain
router.post('/:id/retain', protect, async (req, res) => {
  try {
    const { teamId, playerId, retainPrice } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const team   = await Team.findById(teamId);
    const player = await Player.findById(playerId);
    if (!team || !player) return res.status(404).json({ success: false, message: 'Team or player not found' });

    // BUG FIX #9: prevent double-retention
    if (player.status === 'retained')
      return res.status(400).json({ success: false, message: `${player.name} is already retained` });
    if (player.status !== 'remaining')
      return res.status(400).json({ success: false, message: `${player.name} is not available (status: ${player.status})` });

    if (retainPrice > team.budgetLeft)
      return res.status(400).json({ success: false, message: 'Insufficient budget' });

    player.status     = 'retained';
    player.isRetained = true;
    player.retainedBy = teamId;
    player.retainPrice = retainPrice;
    player.soldTo     = teamId;
    player.soldPrice  = retainPrice;
    await player.save();

    team.retainedPlayers = team.retainedPlayers || [];
    team.players         = team.players || [];
    team.retainedPlayers.push({ player: playerId, retainPrice });
    team.players.push({ player: playerId, soldPrice: retainPrice, isRetained: true });
    team.budgetLeft = Math.round((team.budgetLeft - retainPrice) * 10) / 10;
    await team.save();

    room.auctionLog.push({ message: `🔒 ${player.name} retained by ${team.name} @ ${retainPrice} pts`, type: 'retain' });
    await room.save();

    res.json({ success: true, data: { player, team } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/rooms/:id/retain/:playerId
router.delete('/:id/retain/:playerId', protect, async (req, res) => {
  try {
    const { id, playerId } = req.params;
    const player = await Player.findOne({ _id: playerId, room: id, status: 'retained' });
    if (!player) return res.status(404).json({ success: false, message: 'Retained player not found' });

    const team = await Team.findById(player.retainedBy);
    if (team) {
      team.budgetLeft        = Math.round((team.budgetLeft + (player.retainPrice || 0)) * 10) / 10;
      team.retainedPlayers   = team.retainedPlayers.filter(r => r.player?.toString() !== playerId);
      team.players           = team.players.filter(tp => tp.player?.toString() !== playerId);
      await team.save();
    }

    player.status      = 'remaining';
    player.isRetained  = false;
    player.retainedBy  = null;
    player.retainPrice = null;
    player.soldTo      = null;
    player.soldPrice   = null;
    await player.save();

    const room = await Room.findById(id);
    if (room) {
      room.auctionLog.push({ message: `🔓 ${player.name} retention released from ${team?.name || 'team'}`, type: 'info' });
      await room.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/:id/round2
router.post('/:id/round2', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const result = await Player.updateMany(
      { room: room._id, status: 'unsold' },
      { $set: { status: 'remaining' } }
    );

    room.status        = 'active';
    room.currentPlayer = null;
    room.currentBid    = 0;
    room.currentBidder = null;
    room.auctionLog.push({ message: `🔄 Round 2 started — ${result.modifiedCount} unsold player(s) re-entered`, type: 'info' });
    await room.save();

    res.json({ success: true, data: room, resetCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/:id/pick-unsold
router.post('/:id/pick-unsold', protect, async (req, res) => {
  try {
    const { playerId, teamId, price } = req.body;
    if (!playerId || !teamId || price === undefined)
      return res.status(400).json({ success: false, message: 'playerId, teamId and price are required' });

    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });
    if (player.status !== 'unsold')
      return res.status(400).json({ success: false, message: `${player.name} is not unsold (status: ${player.status})` });

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const slotsLeft = team.slots - (team.players?.length || 0);
    if (Number(price) > team.budgetLeft)
      return res.status(400).json({ success: false, message: `Insufficient budget (need ${price}, have ${team.budgetLeft})` });
    if (slotsLeft <= 0)
      return res.status(400).json({ success: false, message: 'Team roster is already full' });

    await Player.findByIdAndUpdate(playerId, { status: 'sold', soldTo: teamId, soldPrice: Number(price) });
    team.players = team.players || [];
    team.players.push({ player: playerId, soldPrice: Number(price), isRetained: false });
    team.budgetLeft = Math.round((team.budgetLeft - Number(price)) * 100) / 100;
    await team.save();

    room.auctionLog.push({ message: `✅ ${player.name} → ${team.name} for ${price} pts (direct pick)`, type: 'sold', timestamp: new Date() });
    await room.save();

    res.json({ success: true, data: { player, team, price } });
  } catch (err) {
    console.error('pick-unsold error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;