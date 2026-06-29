const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Room    = require('../models/Room');
const Team    = require('../models/Team');
const Player  = require('../models/Player');
const AdminLog = require('../models/AdminLog');

// All routes here are mounted behind `protect` + `adminOnly` in server.js

// Fire-and-forget audit log write — never let logging failure break the actual action
const logAction = (adminId, action, message, meta = {}) =>
  AdminLog.create({ admin: adminId, action, message, meta }).catch(err => console.error('AdminLog write failed:', err.message));

// GET /api/admin/stats — platform-wide overview numbers
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalRooms, totalTeams, totalPlayers, statusAgg, moneyAgg, tournamentNames] =
      await Promise.all([
        User.countDocuments(),
        Room.countDocuments(),
        Team.countDocuments(),
        Player.countDocuments(),
        Room.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Player.aggregate([
          { $match: { soldPrice: { $ne: null } } },
          { $group: { _id: null, total: { $sum: '$soldPrice' } } },
        ]),
        Room.distinct('tournament.name'),
      ]);

    const roomsByStatus = { setup: 0, active: 0, paused: 0, completed: 0 };
    statusAgg.forEach(s => { if (s._id) roomsByStatus[s._id] = s.count; });

    res.json({
      success: true,
      data: {
        totalUsers,
        totalRooms,
        totalTeams,
        totalPlayers,
        totalTournaments: tournamentNames.filter(n => n && n.trim()).length,
        totalMoneyTransacted: moneyAgg[0]?.total || 0,
        roomsByStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/users — all users + how many rooms each owns
router.get('/users', async (req, res) => {
  try {
    const users = await User.aggregate([
      { $project: { name: 1, email: 1, role: 1, avatar: 1, createdAt: 1 } },
      {
        $lookup: {
          from: 'rooms',
          localField: '_id',
          foreignField: 'owner',
          as: 'rooms',
        },
      },
      { $addFields: { roomCount: { $size: '$rooms' } } },
      { $project: { rooms: 0 } },
      { $sort: { createdAt: -1 } },
    ]);
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'auctioneer', 'viewer'].includes(role))
      return res.status(400).json({ success: false, message: 'Invalid role' });
    if (req.params.id === String(req.user._id) && role !== 'admin')
      return res.status(400).json({ success: false, message: "You can't remove your own admin access" });

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    logAction(req.user._id, 'role_change', `Changed ${user.name}'s role to "${role}"`, { userId: user._id, role });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === String(req.user._id))
      return res.status(400).json({ success: false, message: "You can't delete your own account" });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    logAction(req.user._id, 'user_delete', `Deleted user "${user.name}" (${user.email})`, { userId: user._id, email: user.email });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/rooms — every room on the platform, with owner + counts
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.aggregate([
      {
        $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'owner' },
      },
      { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
      {
        $lookup: { from: 'teams', localField: '_id', foreignField: 'room', as: 'teams' },
      },
      {
        $lookup: { from: 'players', localField: '_id', foreignField: 'room', as: 'players' },
      },
      {
        $project: {
          name: 1, code: 1, status: 1, tournament: 1, createdAt: 1, scheduledAt: 1,
          'owner.name': 1, 'owner.email': 1,
          teamCount: { $size: '$teams' },
          playerCount: { $size: '$players' },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
    res.json({ success: true, data: rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/rooms/:id/status — force a room into any status
router.patch('/rooms/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['setup', 'active', 'paused', 'completed'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });
    const room = await Room.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    logAction(req.user._id, 'room_status', `Set room "${room.name}" (${room.code}) status to "${status}"`, { roomId: room._id, status });
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/rooms/:id/schedule — set/change/clear a room's planned start time
router.patch('/rooms/:id/schedule', async (req, res) => {
  try {
    const { scheduledAt } = req.body; // ISO string, or null to clear
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { scheduledAt: scheduledAt || null },
      { new: true }
    );
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    logAction(req.user._id, 'room_status', `Scheduled "${room.name}" (${room.code}) for ${scheduledAt ? new Date(scheduledAt).toLocaleString() : '— cleared —'}`,
      { roomId: room._id, scheduledAt });
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/rooms/:id — cascade delete room + its teams + players
router.delete('/rooms/:id', async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    await Promise.all([
      Team.deleteMany({ room: room._id }),
      Player.deleteMany({ room: room._id }),
    ]);
    logAction(req.user._id, 'room_delete', `Deleted room "${room.name}" (${room.code}) and all its teams/players`, { roomId: room._id, code: room.code });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Live auction intervention ──────────────────────────────────────────────
// Lets an admin fix a wrong sold price, or send a player back into the
// remaining pool to be re-auctioned, while a room is live.

// GET /api/admin/rooms/:id/snapshot — current player/bid/bidder, for the live dashboard view
router.get('/rooms/:id/snapshot', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('currentPlayer')
      .populate('currentBidder', 'name color logo budgetLeft');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({
      success: true,
      data: {
        name: room.name,
        code: room.code,
        status: room.status,
        currentPlayer: room.currentPlayer,
        currentBid: room.currentBid,
        currentBidder: room.currentBidder,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/rooms/:id/players — full player list for one room
router.get('/rooms/:id/players', async (req, res) => {
  try {
    const players = await Player.find({ room: req.params.id })
      .populate('soldTo', 'name color logo')
      .populate('retainedBy', 'name color logo')
      .sort({ auctionOrder: 1, createdAt: 1 });
    res.json({ success: true, data: players });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/players/:id/price — correct a wrong sold/retained price
router.patch('/players/:id/price', async (req, res) => {
  try {
    const newPrice = Number(req.body.soldPrice);
    if (Number.isNaN(newPrice) || newPrice < 0)
      return res.status(400).json({ success: false, message: 'Invalid price' });

    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });
    if (!['sold', 'retained'].includes(player.status))
      return res.status(400).json({ success: false, message: `${player.name} is not sold/retained — nothing to correct` });

    const team = await Team.findById(player.soldTo);
    if (!team) return res.status(404).json({ success: false, message: 'Owning team not found' });

    const oldPrice = player.soldPrice || 0;
    const budgetAfterRefund = Math.round((team.budgetLeft + oldPrice) * 100) / 100;
    if (newPrice > budgetAfterRefund)
      return res.status(400).json({ success: false, message: `Insufficient budget — team only has ${budgetAfterRefund} pts available` });

    team.budgetLeft = Math.round((budgetAfterRefund - newPrice) * 100) / 100;
    team.players = (team.players || []).map(tp =>
      tp.player?.toString() === player._id.toString() ? { ...tp.toObject?.() || tp, soldPrice: newPrice } : tp
    );
    if (player.status === 'retained') {
      team.retainedPlayers = (team.retainedPlayers || []).map(rp =>
        rp.player?.toString() === player._id.toString() ? { ...rp.toObject?.() || rp, retainPrice: newPrice } : rp
      );
      player.retainPrice = newPrice;
    }
    await team.save();

    player.soldPrice = newPrice;
    await player.save();

    const room = await Room.findById(player.room);
    if (room) {
      room.auctionLog.push({
        message: `🛠 Admin corrected ${player.name}'s price: ${oldPrice} → ${newPrice} pts`,
        type: 'info',
      });
      await room.save();
    }
    logAction(req.user._id, 'price_correction', `Corrected ${player.name}'s price: ${oldPrice} → ${newPrice} pts (room: ${room?.name || '—'})`,
      { playerId: player._id, roomId: player.room, oldPrice, newPrice });

    res.json({ success: true, data: { player, team } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/players/:id/revert — send a sold/unsold/retained player back to the pool
router.post('/players/:id/revert', async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });
    if (player.status === 'remaining')
      return res.status(400).json({ success: false, message: `${player.name} is already in the pool` });

    if (player.soldTo) {
      const team = await Team.findById(player.soldTo);
      if (team) {
        team.budgetLeft = Math.round(((team.budgetLeft || 0) + (player.soldPrice || 0)) * 100) / 100;
        team.players = (team.players || []).filter(tp => tp.player?.toString() !== player._id.toString());
        team.retainedPlayers = (team.retainedPlayers || []).filter(rp => rp.player?.toString() !== player._id.toString());
        await team.save();
      }
    }

    const prevStatus = player.status;
    player.status      = 'remaining';
    player.isRetained  = false;
    player.soldTo      = null;
    player.soldPrice   = null;
    player.retainedBy  = null;
    player.retainPrice = null;
    await player.save();

    const room = await Room.findById(player.room);
    if (room) {
      room.auctionLog.push({
        message: `🛠 Admin sent ${player.name} back to the pool (was: ${prevStatus})`,
        type: 'info',
      });
      await room.save();
    }
    logAction(req.user._id, 'player_revert', `Sent ${player.name} back to the pool (was: ${prevStatus}, room: ${room?.name || '—'})`,
      { playerId: player._id, roomId: player.room, prevStatus });

    res.json({ success: true, data: player });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/logs — recent admin activity (most recent first)
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const logs = await AdminLog.find()
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;