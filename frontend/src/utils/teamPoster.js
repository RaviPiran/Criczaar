// Draws a shareable squad poster (PNG) as a grid of individual player
// ID-cards — silhouette/photo, role label, diagonal accent stripe, name
// banner — with the team badge in the final grid cell. Pure Canvas API,
// no extra npm packages needed. Call downloadTeamCard(team) from onClick.

const CARD_W = 200, CARD_H = 292;
const GAP = 14;
const OUTER_PAD = 26;   // lavender frame thickness
const INNER_PAD = 22;   // space between frame and card grid
const IMG_H = 190;      // photo/silhouette area height
const NAME_H = CARD_H - IMG_H; // bottom navy name band

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

// Simple flat "person" silhouette — head + shoulders — used when a player has no photo.
function drawSilhouette(ctx, x, y, w, h, color) {
  const cx = x + w / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = color;
  // head
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.36, w * 0.17, 0, Math.PI * 2);
  ctx.fill();
  // shoulders
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.98, w * 0.34, h * 0.32, 0, Math.PI, 0, true);
  ctx.fill();
  ctx.restore();
}

function wrapWords(ctx, text, maxWidth) {
  const words = text.toUpperCase().split(' ');
  const lines = [];
  let line = '';
  words.forEach(word => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

async function drawPlayerCard(ctx, x, y, player, accent) {
  drawRoundedRect(ctx, x, y, CARD_W, CARD_H, 14);
  ctx.save();
  ctx.clip();

  // photo / silhouette area
  ctx.fillStyle = '#dbe3ea';
  ctx.fillRect(x, y, CARD_W, IMG_H);

  const img = player.photo ? await loadImage(player.photo) : null;
  if (img) {
    const scale = Math.max(CARD_W / img.width, IMG_H / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    ctx.drawImage(img, x + (CARD_W - iw) / 2, y + (IMG_H - ih) / 2, iw, ih);
  } else {
    drawSilhouette(ctx, x, y + 14, CARD_W, IMG_H - 14, '#aab4bf');
  }

  // diagonal accent stripe across the bottom of the photo area
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, CARD_W, IMG_H);
  ctx.clip();
  const stripeY = y + IMG_H - 34;
  const grad = ctx.createLinearGradient(x, stripeY, x + CARD_W, stripeY + 40);
  grad.addColorStop(0, accent);
  grad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, stripeY + 40);
  ctx.lineTo(x + CARD_W, stripeY - 18);
  ctx.lineTo(x + CARD_W, stripeY + 18);
  ctx.lineTo(x, stripeY + 40 + 36);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // role label (top-left)
  if (player.role) {
    ctx.font = '800 15px Arial, sans-serif';
    ctx.fillStyle = '#16233d';
    ctx.textAlign = 'left';
    const lines = wrapWords(ctx, player.role, CARD_W - 24);
    lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, x + 12, y + 22 + i * 18));
  }

  // captain / vice-captain tag (top-right, only if provided)
  if (player.tag) {
    ctx.font = '700 14px Arial, sans-serif';
    ctx.fillStyle = '#16233d';
    ctx.textAlign = 'right';
    ctx.fillText(player.tag, x + CARD_W - 10, y + 38);
  }

  // name band
  ctx.fillStyle = '#16233d';
  ctx.fillRect(x, y + IMG_H, CARD_W, NAME_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 20px "Poppins", Arial, sans-serif';
  const nameParts = player.name.split(' ');
  const first = nameParts[0] || '';
  const rest = nameParts.slice(1).join(' ');
  const midY = y + IMG_H + NAME_H / 2;
  if (rest) {
    ctx.fillText(first, x + CARD_W / 2, midY - 6);
    ctx.fillText(rest, x + CARD_W / 2, midY + 20);
  } else {
    ctx.fillText(first, x + CARD_W / 2, midY + 7);
  }

  ctx.restore(); // un-clip card

  // card border
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, CARD_W, CARD_H, 14);
  ctx.stroke();
}

async function drawBadgeCard(ctx, x, y, team) {
  drawRoundedRect(ctx, x, y, CARD_W, CARD_H, 14);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#eef1f5';
  ctx.fillRect(x, y, CARD_W, CARD_H);

  const logoImg = await loadImage(team.logo);
  const r = 60, cx = x + CARD_W / 2, cy = y + CARD_H / 2 - 30;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  if (logoImg) {
    const scale = Math.max((r * 2) / logoImg.width, (r * 2) / logoImg.height);
    const iw = logoImg.width * scale, ih = logoImg.height * scale;
    ctx.drawImage(logoImg, cx - iw / 2, cy - ih / 2, iw, ih);
  } else {
    ctx.fillStyle = team.color || '#dc2626';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${r}px "Poppins", Arial, sans-serif`;
    ctx.fillText((team.name || '?')[0].toUpperCase(), cx, cy + 6);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  ctx.strokeStyle = team.color || '#dc2626';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = '#16233d';
  ctx.font = '800 22px "Poppins", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(team.name || 'TEAM', x + CARD_W / 2, y + CARD_H - 34);

  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, CARD_W, CARD_H, 14);
  ctx.stroke();
}

export async function downloadTeamCard(team) {
  try { await document.fonts.ready; } catch { /* ignore */ }

  const accent = team.color || '#dc2626';
  const squad = (team.players || []).filter(e => e.player).map(e => ({
    name: e.player.name || '—',
    photo: e.player.photo || '',
    role: e.player.role || '',
    tag: e.isCaptain ? '(C)' : e.isViceCaptain ? '(VC)' : '',
  }));

  const totalCells = squad.length + 1; // +1 for the team badge cell
  const COLS = Math.min(5, Math.max(2, totalCells));
  const rows = Math.ceil(totalCells / COLS);

  const gridW = COLS * CARD_W + (COLS - 1) * GAP;
  const gridH = rows * CARD_H + (rows - 1) * GAP;
  const W = gridW + (OUTER_PAD + INNER_PAD) * 2;
  const H = gridH + (OUTER_PAD + INNER_PAD) * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // outer lavender-grey frame
  ctx.fillStyle = '#c7c8d6';
  ctx.fillRect(0, 0, W, H);
  drawRoundedRect(ctx, OUTER_PAD / 2, OUTER_PAD / 2, W - OUTER_PAD, H - OUTER_PAD, 16);
  ctx.lineWidth = OUTER_PAD;
  ctx.strokeStyle = '#b9bad0';
  ctx.stroke();

  const gridX = OUTER_PAD + INNER_PAD;
  const gridY = OUTER_PAD + INNER_PAD;

  for (let i = 0; i < squad.length; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = gridX + col * (CARD_W + GAP);
    const y = gridY + row * (CARD_H + GAP);
    await drawPlayerCard(ctx, x, y, squad[i], accent);
  }
  // team badge in the very last cell
  const lastCol = squad.length % COLS, lastRow = Math.floor(squad.length / COLS);
  await drawBadgeCard(ctx, gridX + lastCol * (CARD_W + GAP), gridY + lastRow * (CARD_H + GAP), team);

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