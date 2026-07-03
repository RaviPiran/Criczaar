const express = require('express');
const router  = express.Router();
const PDFDocument = require('pdfkit');
const Player        = require('../models/Player');
const PlayerRequest = require('../models/PlayerRequest');
const Room          = require('../models/Room');
const protect       = require('../middleware/auth');

// ── Layout (pdfkit: y=0 is TOP, increases downward) ──────────────────────────
const PW = 841.89, PH = 595.28;  // landscape A4
const COLS = 3, ROWS = 4, CARDS = 12;
const MARGIN = 16, GAP = 8, HEADER = 26;
const CW = (PW - 2*MARGIN - (COLS-1)*GAP) / COLS;
const CH = (PH - MARGIN - HEADER - (ROWS-1)*GAP) / ROWS;
const RADIUS = 7;
const PHOTO_W = 74;

const ROLE_COLORS = {
  'Batsman':       '#1d4ed8',
  'Bowler':        '#dc2626',
  'All-Rounder':   '#7c3aed',
  'Wicket-Keeper': '#0f172a',
};
const STATUS_COLORS = {
  'sold':      '#059669',
  'retained':  '#7c3aed',
  'unsold':    '#dc2626',
  'remaining': '#64748b',
};

function drawCard(doc, player, cx, cy) {
  // cx, cy = top-left of card (pdfkit y increases downward)
  const status  = player.status || 'remaining';
  const role    = player.role   || '';
  const accent  = ROLE_COLORS[role]   || '#1d4ed8';
  const stColor = STATUS_COLORS[status] || '#64748b';

  // Card background + border
  doc.save()
    .roundedRect(cx, cy, CW, CH, RADIUS)
    .fillAndStroke('#ffffff', '#d1d5db')
    .restore();

  // Left photo column — accent colour background
  doc.save()
    .roundedRect(cx, cy, PHOTO_W, CH, RADIUS)
    .clip()
    .rect(cx, cy, PHOTO_W, CH)
    .fill(accent)
    .restore();

  // Photo
  const photo = player.photo || '';
  if (photo) {
    try {
      const buf = Buffer.from(photo.includes(',') ? photo.split(',')[1] : photo, 'base64');
      doc.save()
        .roundedRect(cx, cy, PHOTO_W, CH, RADIUS)
        .clip()
        .image(buf, cx, cy, { width: PHOTO_W, height: CH, cover: [PHOTO_W, CH], align: 'center', valign: 'center' })
        .restore();
    } catch (_) {}
  } else {
    // Initial letter centred in photo column
    doc.save()
      .fillColor('#ffffff')
      .fontSize(30).font('Helvetica-Bold')
      .text((player.name||'?')[0].toUpperCase(), cx, cy + CH/2 - 18, { width: PHOTO_W, align: 'center', lineBreak: false })
      .restore();
  }

  // Number badge — bottom of photo column
  doc.save()
    .fillColor([0,0,0], 0.5)
    .roundedRect(cx+4, cy+CH-18, 24, 14, 3).fill()
    .fillColor('#ffffff').fontSize(7).font('Helvetica-Bold')
    .text(`#${player.idx||''}`, cx+4, cy+CH-14, { width:24, align:'center', lineBreak:false })
    .restore();

  // ── RIGHT INFO COLUMN (y increases downward from top of card) ────────────
  const rx = cx + PHOTO_W + 7;
  const rw = CW - PHOTO_W - 13;
  let   ry = cy + 8;    // start from near TOP of card

  // Role badge
  const roleLabel = (role || 'PLAYER').toUpperCase().slice(0,12);
  const badgeW    = Math.min(rw, 64);
  doc.save()
    .fillColor(accent)
    .roundedRect(rx, ry, badgeW, 14, 3).fill()
    .fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
    .text(roleLabel, rx, ry+3.5, { width:badgeW, align:'center', lineBreak:false })
    .restore();
  ry += 18;

  // Name
  const name = player.name || '—';
  const displayName = name.length > 18 ? name.slice(0,17)+'…' : name;
  doc.save()
    .fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold')
    .text(displayName, rx, ry, { width:rw, lineBreak:false })
    .restore();
  ry += 16;

  // Batting style — use square bullet instead of emoji
  const bat  = (player.battingStyle||'').replace('Right-hand','RH').replace('Left-hand','LH');
  const bowl = (player.bowlingStyle||'').replace('Right-arm','RA').replace('Left-arm','LA');
  doc.save().fillColor('#334155').fontSize(7).font('Helvetica');
  if (bat) {
    doc.text(`- ${bat}`, rx, ry, { width:rw, lineBreak:false });
    ry += 11;
  }
  if (bowl && bowl.trim() !== 'N/A') {
    doc.text(`- ${bowl}`, rx, ry, { width:rw, lineBreak:false });
    ry += 11;
  }
  doc.restore();

  // Phone
  const phone = player.phone || '';
  if (phone) {
    doc.save()
      .fillColor('#0f172a').fontSize(7).font('Helvetica-Bold')
      .text(`- ${phone}`, rx, ry, { width:rw, lineBreak:false })
      .restore();
    ry += 11;
  }

  // ── BOTTOM SECTION (base price + status + sold-to) ───────────────────────
  // Divider — positioned 42pts from bottom of card
  const divY = cy + CH - 42;
  doc.save().strokeColor('#e2e8f0').lineWidth(0.5)
    .moveTo(rx, divY).lineTo(cx+CW-6, divY).stroke().restore();

  // Base price label
  doc.save().fillColor('#94a3b8').fontSize(6).font('Helvetica')
    .text('Base Price', rx, divY+4, { lineBreak:false }).restore();

  // Base price value
  doc.save().fillColor('#1e293b').fontSize(9).font('Helvetica-Bold')
    .text(`${player.basePrice||0} pts`, rx, divY+13, { lineBreak:false }).restore();

  // Status badge (right side of bottom section) — solid fill for visibility
  const stW = 56, stX = cx+CW-stW-5, stY = divY+11;
  doc.save()
    .fillColor(stColor).roundedRect(stX, stY, stW, 14, 3).fill()
    .fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
    .text(status.toUpperCase(), stX, stY+3.5, { width:stW, align:'center', lineBreak:false })
    .restore();

  // Sold-to team (bottom row)
  const soldTo = player.soldTo || '';
  if (soldTo && ['sold','retained'].includes(status)) {
    doc.save().fillColor('#64748b').fontSize(6).font('Helvetica')
      .text(`-> ${soldTo.slice(0,22)}`, rx, cy+CH-12, { lineBreak:false }).restore();
    if (player.soldPrice) {
      doc.save().fillColor(stColor).fontSize(7).font('Helvetica-Bold')
        .text(`${player.soldPrice} pts`, cx+CW-60, cy+CH-12, { width:55, align:'right', lineBreak:false }).restore();
    }
  }
}

function drawHeader(doc, roomName, tournament, page, total) {
  // Header sits at the BOTTOM of the landscape page (pdfkit y=0 is top)
  const hY = PH - HEADER + 4;
  doc.save()
    .fillColor('#0f172a').fontSize(12).font('Helvetica-Bold')
    .text(`${roomName.toUpperCase()}  --  PLAYER LOGBOOK`, MARGIN, hY, { lineBreak:false });
  if (tournament) {
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
      .text(`| ${tournament}`, MARGIN + roomName.length*7 + 20, hY+3, { lineBreak:false });
  }
  doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
    .text(`Page ${page} of ${total}`, PW-MARGIN-90, hY, { width:90, align:'right', lineBreak:false });
  doc.restore();
}

router.get('/:id/players-pdf', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).lean();
    if (!room) return res.status(404).json({ success:false, message:'Room not found' });

    const players = await Player.find({ room: req.params.id })
      .sort({ auctionOrder:1, createdAt:1 })
      .populate('soldTo','name color')
      .populate('retainedBy','name color')
      .lean();

    // Phone fallback from PlayerRequest
    const requests = await PlayerRequest.find({ room: req.params.id, status:'approved' })
      .select('name phone playerId').lean();
    const phoneByPlayerId = {}, phoneByName = {};
    for (const r of requests) {
      if (r.phone) {
        if (r.playerId) phoneByPlayerId[String(r.playerId)] = r.phone;
        if (r.name)     phoneByName[r.name.toLowerCase()]   = r.phone;
      }
    }

    const enriched = players.map((p,i) => ({
      idx:          i+1,
      name:         p.name,
      phone:        p.phone || phoneByPlayerId[String(p._id)] || phoneByName[(p.name||'').toLowerCase()] || '',
      role:         p.role         || '',
      battingStyle: p.battingStyle || '',
      bowlingStyle: p.bowlingStyle || '',
      basePrice:    p.basePrice    || 0,
      status:       p.status       || 'remaining',
      soldPrice:    p.soldPrice    || null,
      soldTo:       p.soldTo?.name || p.retainedBy?.name || '',
      photo:        p.photo        || '',
    }));

    const totalPages = Math.max(1, Math.ceil(enriched.length / CARDS));
    const filename   = `${room.name.replace(/[^a-z0-9]/gi,'_')}_players.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size:[PW,PH], margin:0, autoFirstPage:false });
    doc.pipe(res);

    for (let pg = 0; pg < totalPages; pg++) {
      doc.addPage();
      drawHeader(doc, room.name, room.tournament?.name||'', pg+1, totalPages);

      const pagePlayers = enriched.slice(pg*CARDS, (pg+1)*CARDS);
      for (let idx = 0; idx < pagePlayers.length; idx++) {
        const col    = idx % COLS;
        const row    = Math.floor(idx / COLS);
        const card_x = MARGIN + col*(CW+GAP);
        const card_y = MARGIN + row*(CH+GAP);   // y from TOP (pdfkit)
        drawCard(doc, pagePlayers[idx], card_x, card_y);
      }
    }

    doc.end();
  } catch (err) {
    console.error('PDF error:', err.message);
    if (!res.headersSent)
      res.status(500).json({ success:false, message:'PDF generation failed: '+err.message });
  }
});

module.exports = router;