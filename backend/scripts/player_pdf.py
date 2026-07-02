#!/usr/bin/env python3
"""CricZaar Player Logbook — landscape A4, 12 cards per page (3x4), large photo."""
import sys, json, base64, io, math
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.colors import HexColor, white, Color
from reportlab.lib.utils import ImageReader

# ── Layout ────────────────────────────────────────────────────────────────────
W, H   = landscape(A4)   # 841.89 x 595.28 pts
COLS   = 3
ROWS   = 4
CARDS  = COLS * ROWS     # 12
MARGIN = 16
GAP    = 8
HEADER = 24              # top header height
CW     = (W - 2*MARGIN - (COLS-1)*GAP) / COLS   # ~259 pts  (~91mm)
CH     = (H - MARGIN - HEADER - GAP - (ROWS-1)*GAP) / ROWS  # ~122 pts (~43mm)

RADIUS = 7

STATUS_COLORS = {
    'sold':      '#059669',
    'retained':  '#7c3aed',
    'unsold':    '#dc2626',
    'remaining': '#64748b',
}
ROLE_COLORS = {
    'Batsman':      '#1d4ed8',
    'Bowler':       '#dc2626',
    'All-Rounder':  '#7c3aed',
    'Wicket-Keeper':'#0f172a',
}

def hex_color(h):
    h = h.lstrip('#')
    if len(h) == 6:
        return Color(int(h[0:2],16)/255, int(h[2:4],16)/255, int(h[4:6],16)/255)
    return HexColor('#64748b')

def rounded_rect(c, x, y, w, h, r, fill, stroke=None, sw=0):
    c.setFillColor(fill)
    if stroke: c.setStrokeColor(stroke); c.setLineWidth(sw)
    p = c.beginPath()
    p.moveTo(x+r, y); p.lineTo(x+w-r, y)
    p.arcTo(x+w-2*r, y, x+w, y+2*r, startAng=-90, extent=90)
    p.lineTo(x+w, y+h-r)
    p.arcTo(x+w-2*r, y+h-2*r, x+w, y+h, startAng=0, extent=90)
    p.lineTo(x+r, y+h)
    p.arcTo(x, y+h-2*r, x+2*r, y+h, startAng=90, extent=90)
    p.lineTo(x, y+r)
    p.arcTo(x, y, x+2*r, y+2*r, startAng=180, extent=90)
    p.close()
    c.drawPath(p, fill=1, stroke=1 if stroke else 0)

def clip_circle(c, cx, cy, r):
    p = c.beginPath(); p.circle(cx, cy, r); c.clipPath(p, fill=0, stroke=0)

def draw_card(c, player, cx, cy):
    pad    = 8
    status = player.get('status', 'remaining')
    role   = player.get('role', '')
    accent = hex_color(ROLE_COLORS.get(role, '#1d4ed8'))

    # Card background + border
    rounded_rect(c, cx, cy, CW, CH, RADIUS,
                 HexColor('#ffffff'), stroke=HexColor('#d1d5db'), sw=0.8)

    # ── LEFT: big photo column ─────────────────────────────────────────────
    PHOTO_W = 72   # wide photo box
    PHOTO_H = CH - 2   # full card height minus tiny border

    # Photo background
    c.setFillColor(hex_color(ROLE_COLORS.get(role, '#1d4ed8')))
    # Left rounded only
    p = c.beginPath()
    p.moveTo(cx+RADIUS, cy+1)
    p.lineTo(cx+PHOTO_W, cy+1)
    p.lineTo(cx+PHOTO_W, cy+PHOTO_H+1)
    p.lineTo(cx+RADIUS, cy+PHOTO_H+1)
    p.arcTo(cx, cy+PHOTO_H-2*RADIUS+1, cx+2*RADIUS, cy+PHOTO_H+1, startAng=90, extent=90)
    p.lineTo(cx, cy+RADIUS+1)
    p.arcTo(cx, cy+1, cx+2*RADIUS, cy+2*RADIUS+1, startAng=180, extent=90)
    p.close()
    c.drawPath(p, fill=1, stroke=0)

    photo_b64 = player.get('photo', '')
    photo_drawn = False
    if photo_b64:
        try:
            raw = photo_b64.split(',')[-1]
            img = ImageReader(io.BytesIO(base64.b64decode(raw)))
            c.saveState()
            # Clip to left column
            p2 = c.beginPath()
            p2.moveTo(cx+RADIUS, cy+1)
            p2.lineTo(cx+PHOTO_W, cy+1)
            p2.lineTo(cx+PHOTO_W, cy+PHOTO_H+1)
            p2.lineTo(cx+RADIUS, cy+PHOTO_H+1)
            p2.arcTo(cx, cy+PHOTO_H-2*RADIUS+1, cx+2*RADIUS, cy+PHOTO_H+1, startAng=90, extent=90)
            p2.lineTo(cx, cy+RADIUS+1)
            p2.arcTo(cx, cy+1, cx+2*RADIUS, cy+2*RADIUS+1, startAng=180, extent=90)
            p2.close()
            c.clipPath(p2, fill=0, stroke=0)
            c.drawImage(img, cx+1, cy+1, PHOTO_W-1, PHOTO_H, preserveAspectRatio=True, anchor='c')
            c.restoreState()
            photo_drawn = True
        except Exception:
            pass

    if not photo_drawn:
        # Initial letter centred in photo box
        c.setFillColor(white)
        c.setFont('Helvetica-Bold', 28)
        initial = player.get('name', '?')[0].upper()
        c.drawCentredString(cx + PHOTO_W/2, cy + PHOTO_H/2 - 10, initial)
        # small number below
        c.setFont('Helvetica', 9)
        c.drawCentredString(cx + PHOTO_W/2, cy + 8, f'#{player.get("idx","")}')

    # Number badge overlay (bottom-left of photo)
    if photo_drawn:
        c.setFillColor(Color(0,0,0,0.45))
        c.roundRect(cx+4, cy+4, 22, 13, 3, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont('Helvetica-Bold', 7.5)
        c.drawCentredString(cx+15, cy+7.5, f'#{player.get("idx","")}')

    # ── RIGHT: info column ─────────────────────────────────────────────────
    rx  = cx + PHOTO_W + pad      # right content X start
    rw  = CW - PHOTO_W - pad - 6  # right content width
    top = cy + CH - 10            # start drawing from top

    # Role badge + name
    role_color = hex_color(ROLE_COLORS.get(role, '#1d4ed8'))
    badge_w = min(rw, 55)
    c.setFillColor(role_color)
    c.roundRect(rx, top-13, badge_w, 12, 3, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 6.5)
    role_label = role.upper() if role else 'PLAYER'
    c.drawCentredString(rx + badge_w/2, top-9.5, role_label[:12])

    # Name
    name = player.get('name', '—')
    c.setFillColor(HexColor('#0f172a'))
    c.setFont('Helvetica-Bold', 10.5)
    max_chars = 18
    display_name = name if len(name) <= max_chars else name[:max_chars-1]+'…'
    c.drawString(rx, top-26, display_name)

    # Batting / Bowling
    c.setFont('Helvetica', 7)
    c.setFillColor(HexColor('#475569'))
    bat  = player.get('battingStyle','') or ''
    bowl = player.get('bowlingStyle','') or ''
    bat_s  = bat.replace('Right-hand','RH ').replace('Left-hand','LH ')
    bowl_s = bowl.replace('Right-arm','RA ').replace('Left-arm','LA ')
    y_off = top - 38
    if bat_s:
        c.drawString(rx, y_off, f'🏏 {bat_s}'); y_off -= 11
    if bowl_s and bowl_s.strip() != 'N/A':
        c.drawString(rx, y_off, f'⚾ {bowl_s}'); y_off -= 11

    # Phone
    phone = player.get('phone','') or ''
    if phone:
        c.setFont('Helvetica', 7)
        c.setFillColor(HexColor('#0f172a'))
        c.drawString(rx, y_off, f'📞 {phone}'); y_off -= 11

    # Divider
    div_y = cy + 38
    c.setStrokeColor(HexColor('#e2e8f0')); c.setLineWidth(0.5)
    c.line(rx, div_y, cx+CW-6, div_y)

    # Base price
    c.setFont('Helvetica', 6); c.setFillColor(HexColor('#94a3b8'))
    c.drawString(rx, div_y-11, 'Base Price')
    c.setFont('Helvetica-Bold', 8.5); c.setFillColor(HexColor('#1e293b'))
    c.drawString(rx, div_y-21, f"{player.get('basePrice',0)} pts")

    # Status badge
    st_color = hex_color(STATUS_COLORS.get(status, '#64748b'))
    st_w = 50; st_x = cx+CW-st_w-5; st_y = div_y-22
    c.setFillColor(Color(st_color.red, st_color.green, st_color.blue, 0.12))
    c.roundRect(st_x, st_y, st_w, 13, 3, fill=1, stroke=0)
    c.setFillColor(st_color); c.setFont('Helvetica-Bold', 6.5)
    c.drawCentredString(st_x+st_w/2, st_y+3.5, status.upper())

    # Sold-to team
    sold_to = player.get('soldTo','')
    if sold_to and status in ('sold','retained'):
        price = player.get('soldPrice')
        c.setFont('Helvetica', 6); c.setFillColor(HexColor('#64748b'))
        c.drawString(rx, cy+6, f'→ {sold_to[:20]}')
        if price:
            c.setFont('Helvetica-Bold', 6.5); c.setFillColor(st_color)
            c.drawRightString(cx+CW-6, cy+6, f'{price} pts')


def draw_header(c, room_name, tournament, page, total):
    c.setFillColor(HexColor('#0f172a'))
    c.setFont('Helvetica-Bold', 12)
    c.drawString(MARGIN, H-14, f'🏏  {room_name.upper()}  —  PLAYER LOGBOOK')
    if tournament:
        c.setFont('Helvetica', 7.5); c.setFillColor(HexColor('#64748b'))
        c.drawString(MARGIN+len(room_name)*7+80, H-14, f'| {tournament}')
    c.setFont('Helvetica', 8); c.setFillColor(HexColor('#94a3b8'))
    c.drawRightString(W-MARGIN, H-14, f'Page {page} of {total}')


def main():
    json_path, pdf_path = sys.argv[1], sys.argv[2]
    with open(json_path) as f: data = json.load(f)

    players    = data['players']
    for i, p in enumerate(players): p['idx'] = i+1
    room_name  = data.get('roomName','Auction')
    tournament = data.get('tournament','')
    total_pages = max(1, math.ceil(len(players)/CARDS))

    c = canvas.Canvas(pdf_path, pagesize=landscape(A4))
    c.setTitle(f'{room_name} — Player Logbook')

    for pg in range(total_pages):
        page_players = players[pg*CARDS : (pg+1)*CARDS]
        draw_header(c, room_name, tournament, pg+1, total_pages)

        for idx, player in enumerate(page_players):
            col = idx % COLS
            row = idx // COLS
            card_x = MARGIN + col*(CW+GAP)
            card_y = H - MARGIN - HEADER - (row+1)*CH - row*GAP
            draw_card(c, player, card_x, card_y)

        c.showPage()

    c.save()
    print(f'Done: {pdf_path}  ({total_pages}p, {len(players)} players)')

if __name__ == '__main__':
    main()
