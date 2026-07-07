// Draws a shareable, IPL-reveal-style poster (PNG) for a team — logo, name,
// AND the full squad (every player bought, with photo/initial, name, role,
// price) — entirely with the Canvas API so no extra npm packages are needed.
// Call downloadTeamCard(team) from a button's onClick.

const W = 1080;
const COLS = 2;
const CARD_H = 130;
const CARD_GAP = 18;
const MARGIN = 56;
const HEADER_H = 520;
const FOOTER_H = 140;

function themeVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCircleImage(ctx, img, cx, cy, r, fallbackText, fallbackColor) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
  } else {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(r * 0.9)}px "Poppins", Arial, sans-serif`;
    ctx.fillText(fallbackText, cx, cy + r * 0.08);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

export async function downloadTeamCard(team, roomName = '') {
  try { await document.fonts.ready; } catch { /* ignore */ }

  const accent = team.color || '#dc2626';
  const dark   = themeVar('--secondary-900', '#0f172a');

  const squad = (team.players || []).filter(e => e.player).map(e => ({
    name: e.player.name || '—',
    photo: e.player.photo || '',
    role: e.player.role || '',
    price: e.soldPrice,
    retained: !!e.isRetained,
  }));

  const rows = Math.max(1, Math.ceil(squad.length / COLS));
  const gridH = squad.length ? rows * CARD_H + (rows - 1) * CARD_GAP : 160;
  const H = HEADER_H + gridH + FOOTER_H + MARGIN;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, dark);
  bg.addColorStop(1, '#000000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = accent;
  for (let i = -2; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 180 - 100, 0);
    ctx.lineTo(i * 180, 0);
    ctx.lineTo(i * 180 - 260, HEADER_H);
    ctx.lineTo(i * 180 - 360, HEADER_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const glow = ctx.createRadialGradient(W / 2, 230, 30, W / 2, 230, 340);
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, HEADER_H);

  // ── Outer frame ─────────────────────────────────────────────────────
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  drawRoundedRect(ctx, 24, 24, W - 48, H - 48, 28);
  ctx.stroke();

  // ── Header: eyebrow, logo, name ─────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = '700 28px "Orbitron", Arial, sans-serif';
  ctx.fillText('FULL SQUAD', W / 2, 100);

  const logoImg = await loadImage(team.logo);
  const cx = W / 2, cy = 250, r = 130;
  drawCircleImage(ctx, logoImg, cx, cy, r, (team.name || '?')[0].toUpperCase(), accent);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 8; ctx.strokeStyle = accent; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke();

  ctx.fillStyle = '#ffffff';
  let fontSize = 74;
  ctx.font = `800 ${fontSize}px "Poppins", Arial, sans-serif`;
  while (ctx.measureText((team.name || 'TEAM').toUpperCase()).width > W - 140 && fontSize > 36) {
    fontSize -= 4;
    ctx.font = `800 ${fontSize}px "Poppins", Arial, sans-serif`;
  }
  ctx.fillText((team.name || 'TEAM').toUpperCase(), W / 2, 445);
  ctx.fillStyle = accent;
  ctx.fillRect(W / 2 - 80, 470, 160, 5);

  // stats line
  const spent = (team.budget || 0) - (team.budgetLeft ?? team.budget ?? 0);
  ctx.font = '600 26px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(
    `${squad.length}/${team.slots || 11} Players   •   Spent ${Math.round(spent)} pts   •   Left ${Math.round(team.budgetLeft ?? 0)} pts`,
    W / 2, 505
  );

  // ── Squad grid ──────────────────────────────────────────────────────
  const gridTop = HEADER_H;
  if (squad.length === 0) {
    ctx.font = '600 32px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('No players bought yet', W / 2, gridTop + 90);
  } else {
    const cardW = (W - MARGIN * 2 - CARD_GAP * (COLS - 1)) / COLS;
    for (let i = 0; i < squad.length; i++) {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = MARGIN + col * (cardW + CARD_GAP);
      const y = gridTop + row * (CARD_H + CARD_GAP);
      const p = squad[i];

      // card bg
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      drawRoundedRect(ctx, x, y, cardW, CARD_H, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, x, y, cardW, CARD_H, 18);
      ctx.stroke();

      // avatar
      const avR = 42;
      const avCx = x + 30 + avR, avCy = y + CARD_H / 2;
      let img = null;
      if (p.photo) img = await loadImage(p.photo);
      drawCircleImage(ctx, img, avCx, avCy, avR, (p.name[0] || '?').toUpperCase(), accent);

      // name + role
      ctx.textAlign = 'left';
      const textX = avCx + avR + 22;
      ctx.fillStyle = '#ffffff';
      let nameSize = 30;
      ctx.font = `700 ${nameSize}px "Poppins", Arial, sans-serif`;
      const maxNameW = x + cardW - textX - 20;
      let displayName = p.name;
      while (ctx.measureText(displayName).width > maxNameW && displayName.length > 3) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== p.name) displayName = displayName.trim() + '…';
      ctx.fillText(displayName, textX, y + CARD_H / 2 - 6);

      ctx.font = '500 22px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(p.role || (p.retained ? 'Retained' : 'Player'), textX, y + CARD_H / 2 + 28);

      // price badge
      if (p.price) {
        ctx.textAlign = 'right';
        ctx.font = '700 26px "Orbitron", Arial, sans-serif';
        ctx.fillStyle = p.retained ? '#67e8f9' : '#fbbf24';
        ctx.fillText(`${Math.round(p.price)}`, x + cardW - 20, y + CARD_H / 2 - 8);
        ctx.font = '500 18px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(p.retained ? 'RETAINED' : 'PTS', x + cardW - 20, y + CARD_H / 2 + 18);
        ctx.textAlign = 'left';
      }
    }
  }

  // ── Footer branding ─────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '700 30px "Orbitron", Arial, sans-serif';
  ctx.fillText('🏏 CRICZAAR', W / 2, H - 70);
  if (roomName) {
    ctx.font = '500 22px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(roomName, W / 2, H - 38);
  }

  // ── Export & trigger download ───────────────────────────────────────
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(team.name || 'team').replace(/\s+/g, '_')}_squad.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}