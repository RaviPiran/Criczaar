const express = require('express');
const router  = express.Router();
const { execSync } = require('child_process');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const Player        = require('../models/Player');
const PlayerRequest = require('../models/PlayerRequest');
const Room          = require('../models/Room');
const protect       = require('../middleware/auth');

// GET /api/rooms/:id/players-pdf
router.get('/:id/players-pdf', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).lean();
    if (!room) return res.status(404).json({ success:false, message:'Room not found' });

    const players = await Player.find({ room: req.params.id })
      .sort({ auctionOrder: 1, createdAt: 1 })
      .populate('soldTo',     'name color')
      .populate('retainedBy', 'name color')
      .lean();

    // Build a phone lookup from PlayerRequest (covers players approved before
    // the phone field was added to the Player model)
    const requests = await PlayerRequest.find({ room: req.params.id, status: 'approved' })
      .select('name phone playerId')
      .lean();

    // Map by playerId first (most reliable), fallback to name match
    const phoneByPlayerId = {};
    const phoneByName     = {};
    for (const r of requests) {
      if (r.phone) {
        if (r.playerId) phoneByPlayerId[String(r.playerId)] = r.phone;
        if (r.name)     phoneByName[r.name.toLowerCase()]   = r.phone;
      }
    }

    const data = {
      roomName:   room.name,
      roomCode:   room.code,
      tournament: room.tournament?.name || '',
      players: players.map(p => {
        // Try player.phone first, then request lookup
        const phone = p.phone ||
          phoneByPlayerId[String(p._id)] ||
          phoneByName[p.name?.toLowerCase()] ||
          '';
        return {
          name:         p.name,
          phone,
          role:         p.role || '',
          battingStyle: p.battingStyle || '',
          bowlingStyle: p.bowlingStyle || '',
          basePrice:    p.basePrice || 0,
          status:       p.status || 'remaining',
          soldPrice:    p.soldPrice || null,
          soldTo:       p.soldTo?.name || p.retainedBy?.name || '',
          teamColor:    p.soldTo?.color || p.retainedBy?.color || '',
          photo:        p.photo || '',
        };
      }),
    };

    const tmpJson = path.join(os.tmpdir(), `cz_players_${Date.now()}.json`);
    const tmpPdf  = path.join(os.tmpdir(), `cz_players_${Date.now()}.pdf`);
    fs.writeFileSync(tmpJson, JSON.stringify(data));

    const script = path.join(__dirname, '..', 'scripts', 'player_pdf.py');
    execSync(`python3 "${script}" "${tmpJson}" "${tmpPdf}"`, { timeout: 30000 });

    const pdf = fs.readFileSync(tmpPdf);
    fs.unlinkSync(tmpJson);
    fs.unlinkSync(tmpPdf);

    const filename = `${room.name.replace(/[^a-z0-9]/gi,'_')}_players.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('PDF generation error:', err.message);
    res.status(500).json({ success:false, message:'PDF generation failed: ' + err.message });
  }
});

module.exports = router;