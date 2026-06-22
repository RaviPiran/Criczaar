const express       = require('express');
const router        = express.Router();
const PlayerRequest = require('../models/PlayerRequest');
const Player        = require('../models/Player');
const Room          = require('../models/Room');
const protect       = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/player-requests/webhook/:roomCode
// Called by Google Apps Script when a form is submitted.
// NO auth — uses a secret token in the header instead so the public URL is safe.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook/:roomCode', async (req, res) => {
  try {
    // Validate webhook secret (set WEBHOOK_SECRET in your .env)
    const secret = req.headers['x-webhook-secret'];
    if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
    }

    const room = await Room.findOne({ code: req.params.roomCode.toUpperCase() });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const {
      name, email, phone, club, role,
      battingStyle, bowlingStyle, photo,
      autoApprove, // if true, skip approval and add directly
      ...rest
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    // Check for duplicate submission (same name + email + room)
    const existing = await PlayerRequest.findOne({
      room: room._id,
      name: name.trim(),
      ...(email ? { email: email.trim().toLowerCase() } : {}),
      status: { $in: ['pending', 'approved'] },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'This player already registered for this auction' });
    }

    const request = await PlayerRequest.create({
      room: room._id,
      name: name.trim(),
      email: email?.trim().toLowerCase() || '',
      phone: phone?.trim() || '',
      club:  club?.trim()  || '',
      role:  role?.trim()  || '',
      battingStyle: battingStyle || '',
      bowlingStyle: bowlingStyle || '',
      photo: photo || '',
      rawFormData: { ...rest },
      source: 'google_form',
      // Optional: auto-approve if room setting says so
      status: (autoApprove === true || autoApprove === 'true') ? 'approved' : 'pending',
    });

    // If auto-approved, create the Player record immediately
    if (request.status === 'approved') {
      const player = await Player.create({
        name: request.name, email: request.email,
        club: request.club, role: request.role,
        battingStyle: request.battingStyle, bowlingStyle: request.bowlingStyle,
        photo: request.photo, basePrice: room.rules?.basePrice || 0.5,
        room: room._id, status: 'remaining',
      });
      request.playerId = player._id;
      request.reviewedAt = new Date();
      await request.save();
    }

    res.status(201).json({
      success: true,
      message: request.status === 'approved'
        ? 'Player registered and added to auction!'
        : 'Registration received — pending approval.',
      data: { id: request._id, status: request.status },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/player-requests/room/:roomId  — list all requests for a room
// ─────────────────────────────────────────────────────────────────────────────
router.get('/room/:roomId', protect, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { room: req.params.roomId };
    if (status) filter.status = status;
    const requests = await PlayerRequest.find(filter).sort({ createdAt: -1 });
    const counts = {
      pending:  await PlayerRequest.countDocuments({ room: req.params.roomId, status: 'pending' }),
      approved: await PlayerRequest.countDocuments({ room: req.params.roomId, status: 'approved' }),
      rejected: await PlayerRequest.countDocuments({ room: req.params.roomId, status: 'rejected' }),
    };
    res.json({ success: true, data: requests, counts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/player-requests/:id/approve
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve', protect, async (req, res) => {
  try {
    const request = await PlayerRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status === 'approved') return res.status(400).json({ success: false, message: 'Already approved' });

    const room = await Room.findById(request.room);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    // Create the actual Player in the auction
    const player = await Player.create({
      name:         request.name,
      club:         request.club,
      role:         request.role,
      battingStyle: request.battingStyle,
      bowlingStyle: request.bowlingStyle,
      photo:        request.photo,
      basePrice:    req.body.basePrice ?? room.rules?.basePrice ?? 0.5,
      room:         room._id,
      status:       'remaining',
    });

    request.status     = 'approved';
    request.playerId   = player._id;
    request.reviewedAt = new Date();
    await request.save();

    res.json({ success: true, data: { request, player } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/player-requests/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/reject', protect, async (req, res) => {
  try {
    const request = await PlayerRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status === 'rejected') return res.status(400).json({ success: false, message: 'Already rejected' });

    request.status       = 'rejected';
    request.rejectReason = req.body.reason || '';
    request.reviewedAt   = new Date();
    await request.save();

    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/player-requests/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    await PlayerRequest.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/player-requests/register/:roomCode
// PUBLIC route — called directly from the PlayerRegister.jsx page by the player.
// No webhook secret needed — rate limiting by duplicate check is sufficient.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register/:roomCode', async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.roomCode.toUpperCase() });
    if (!room) return res.status(404).json({ success: false, message: 'Auction room not found. Check your link.' });

    const { name, email, phone, club, role, battingStyle, bowlingStyle, photo } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Full name is required' });

    // Duplicate check — same name + room still pending or approved
    const existing = await PlayerRequest.findOne({
      room: room._id,
      name: { $regex: new RegExp('^' + name.trim() + '$', 'i') },
      status: { $in: ['pending', 'approved'] },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You are already registered for this auction.' });
    }

    const request = await PlayerRequest.create({
      room:         room._id,
      name:         name.trim(),
      email:        email?.trim().toLowerCase() || '',
      phone:        phone?.trim() || '',
      club:         club?.trim()  || '',
      role:         role?.trim()  || '',
      battingStyle: battingStyle  || '',
      bowlingStyle: bowlingStyle  || '',
      photo:        photo         || '',
      source:       'self_registration',
      status:       'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Registration received! The organiser will review and add you to the auction.',
      data:    { id: request._id, status: request.status },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
