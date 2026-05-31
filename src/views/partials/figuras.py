from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
import math

# Page dimensions (letter = 612 x 792)
W, H = 612, 792

c = canvas.Canvas("/home/claude/figuras_corregidas.pdf", pagesize=(W, H))

def draw_rounded_rect(c, x, y, w, h, r=8, stroke_width=2):
    c.setLineWidth(stroke_width)
    c.setStrokeColor(colors.black)
    c.setFillColor(colors.white)
    p = c.beginPath()
    p.moveTo(x+r, y)
    p.lineTo(x+w-r, y)
    p.arcTo(x+w-2*r, y, x+w, y+2*r, -90, 90)
    p.lineTo(x+w, y+h-r)
    p.arcTo(x+w-2*r, y+h-2*r, x+w, y+h, 0, 90)
    p.lineTo(x+r, y+h)
    p.arcTo(x, y+h-2*r, x+2*r, y+h, 90, 90)
    p.lineTo(x, y+r)
    p.arcTo(x, y, x+2*r, y+2*r, 180, 90)
    p.close()
    c.drawPath(p, fill=1, stroke=1)

def draw_person_icon(c, cx, cy, size=18):
    """Draw simple person icon"""
    c.setStrokeColor(colors.black)
    c.setFillColor(colors.black)
    c.setLineWidth(1.5)
    # Head
    c.circle(cx, cy + size*0.45, size*0.22, fill=0, stroke=1)
    # Body arc
    import math
    p = c.beginPath()
    p.moveTo(cx - size*0.4, cy - size*0.1)
    p.curveTo(cx - size*0.4, cy + size*0.15, cx + size*0.4, cy + size*0.15, cx + size*0.4, cy - size*0.1)
    c.drawPath(p, fill=0, stroke=1)

def draw_chip_emv(c, x, y, size=10):
    """Draw EMV chip icon"""
    c.setStrokeColor(colors.black)
    c.setFillColor(colors.Color(0.85, 0.75, 0.3))  # gold color
    c.setLineWidth(0.8)
    c.rect(x, y, size, size*0.75, fill=1, stroke=1)
    # Lines on chip
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.line(x + size*0.33, y, x + size*0.33, y + size*0.75)
    c.line(x + size*0.66, y, x + size*0.66, y + size*0.75)
    c.line(x, y + size*0.35, x + size, y + size*0.35)

def draw_nfc_icon(c, cx, cy, size=10):
    """Draw NFC waves icon"""
    c.setStrokeColor(colors.black)
    c.setFillColor(colors.black)
    c.setLineWidth(0.8)
    # Three arcs
    for i in range(3):
        r = size * (0.3 + i * 0.35)
        c.arc(cx - r, cy - r, cx + r, cy + r, -30, 60)

def draw_qr_icon(c, x, y, size=28):
    """Draw QR code icon (simplified)"""
    c.setFillColor(colors.black)
    c.setStrokeColor(colors.black)
    # Background
    c.setFillColor(colors.black)
    c.roundRect(x, y, size, size, 3, fill=1, stroke=0)
    # White inner
    c.setFillColor(colors.white)
    c.roundRect(x+1.5, y+1.5, size-3, size-3, 2, fill=1, stroke=0)
    c.setFillColor(colors.black)
    # Corner squares
    sq = size * 0.22
    g = size * 0.07
    # top-left corner square
    c.rect(x+g, y+size-g-sq, sq, sq, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.rect(x+g+1.5, y+size-g-sq+1.5, sq-3, sq-3, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.rect(x+g+3, y+size-g-sq+3, sq-6, sq-6, fill=1, stroke=0)
    # top-right corner square
    c.setFillColor(colors.black)
    c.rect(x+size-g-sq, y+size-g-sq, sq, sq, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.rect(x+size-g-sq+1.5, y+size-g-sq+1.5, sq-3, sq-3, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.rect(x+size-g-sq+3, y+size-g-sq+3, sq-6, sq-6, fill=1, stroke=0)
    # bottom-left corner square
    c.setFillColor(colors.black)
    c.rect(x+g, y+g, sq, sq, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.rect(x+g+1.5, y+g+1.5, sq-3, sq-3, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.rect(x+g+3, y+g+3, sq-6, sq-6, fill=1, stroke=0)
    # Data dots
    import random
    random.seed(42)
    cell = (size - 2*g - sq - 3) / 7
    for row in range(7):
        for col in range(4):
            if random.random() > 0.45:
                dx = x + size - g - sq - 3 - col * cell
                dy = y + g + sq + 3 + row * cell
                if dx > x+g+sq+2 and dy < y+size-g-sq-2:
                    c.rect(dx, dy, cell*0.8, cell*0.8, fill=1, stroke=0)

def draw_data_lines(c, x, y, w):
    """Draw data lines (text placeholder)"""
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.2)
    c.line(x, y+4, x+w, y+4)
    c.setLineWidth(0.9)
    c.line(x, y, x+w*0.65, y)

def draw_ref_number(c, x, y, num):
    """Draw reference number with leader line"""
    c.setFont("Helvetica", 7)
    c.setFillColor(colors.black)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.drawString(x+3, y-2, str(num))
    # Small circle around number
    c.circle(x+5, y, 5, fill=0, stroke=1)

def ref_label(c, x, y, num, dx=0, dy=0):
    """Draw a reference number label with leader"""
    tx = x + dx
    ty = y + dy
    c.setLineWidth(0.4)
    c.setStrokeColor(colors.black)
    c.line(x, y, tx, ty)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(tx + 2, ty - 2.5, str(num))

# ============================================================
# FIG. 1 — Three cards: physical card, horizontal card, QR card
# ============================================================
fig1_top = H - 40

c.setFont("Helvetica-Bold", 9)
c.setFillColor(colors.black)
c.drawString(50, fig1_top, "Fig. 1")

# --- Card A: Physical card (portrait, left) ---
cx, cy = 140, fig1_top - 100
cw, ch = 65, 82
draw_rounded_rect(c, cx, cy, cw, ch, r=7, stroke_width=2)
draw_person_icon(c, cx + cw*0.38, cy + ch*0.62, size=20)
draw_data_lines(c, cx+10, cy+ch*0.33, cw-20)
# Chip EMV bottom-left
draw_chip_emv(c, cx + 8, cy + 8, size=11)
# NFC top-right
draw_nfc_icon(c, cx + cw - 10, cy + ch - 12, size=8)
# QR small bottom-right
draw_qr_icon(c, cx + cw - 22, cy + 5, size=16)

# Reference numbers for Card A
ref_label(c, cx + cw - 10, cy + ch - 12, 3, dx=22, dy=8)   # NFC -> 3
ref_label(c, cx + 13, cy + 13, 2, dx=-22, dy=-8)             # EMV -> 2
ref_label(c, cx + cw - 14, cy + 13, 1, dx=20, dy=-8)         # QR -> 1

# --- Card B: Horizontal identity card (right) ---
bx, by_ = 225, fig1_top - 88
bw, bh = 88, 62
draw_rounded_rect(c, bx, by_, bw, bh, r=7, stroke_width=2)
draw_person_icon(c, bx + bw*0.25, by_ + bh*0.55, size=18)
draw_data_lines(c, bx + bw*0.5, by_ + bh*0.55, bw*0.38)
draw_data_lines(c, bx + bw*0.5, by_ + bh*0.38, bw*0.28)
# NFC icon on card B
draw_nfc_icon(c, bx + bw*0.85, by_ + bh*0.85, size=7)
# Chip on card B
draw_chip_emv(c, bx + bw*0.65, by_ + 8, size=10)
# QR small
draw_qr_icon(c, bx + bw - 24, by_ + bh*0.28, size=16)

# Ref numbers card B
ref_label(c, bx + bw*0.85, by_ + bh*0.85, 3, dx=14, dy=6)
ref_label(c, bx + bw*0.7, by_ + 13, 2, dx=8, dy=-10)
ref_label(c, bx + bw - 16, by_ + bh*0.44, 1, dx=20, dy=0)

# --- Card C: QR document (center bottom) ---
qx, qy = 185, fig1_top - 220
qw, qh = 78, 60
draw_rounded_rect(c, qx, qy, qw, qh, r=7, stroke_width=2)
draw_qr_icon(c, qx + qw//2 - 18, qy + 8, size=36)

# Ref for QR card
ref_label(c, qx + qw//2, qy + 26, 1, dx=30, dy=10)

# Legend for Fig. 1
c.setFont("Helvetica", 6.5)
c.setFillColor(colors.black)
c.drawString(50, fig1_top - 235, "1 - Código QR único    2 - Chip EMV    3 - Antena NFC")

# ============================================================
# FIG. 2 — Smartphone with digital card
# ============================================================
fig2_top = fig1_top - 270

c.setFont("Helvetica-Bold", 9)
c.drawString(50, fig2_top, "Fig. 2")

# Draw smartphone
ph_x, ph_y = 175, fig2_top - 175
ph_w, ph_h = 80, 160

# Phone body
c.setStrokeColor(colors.black)
c.setFillColor(colors.Color(0.15, 0.15, 0.15))
c.setLineWidth(1.5)
c.roundRect(ph_x, ph_y, ph_w, ph_h, 10, fill=1, stroke=1)

# Screen
sc_pad = 5
c.setFillColor(colors.white)
c.roundRect(ph_x+sc_pad, ph_y+8, ph_w-sc_pad*2, ph_h-16, 6, fill=1, stroke=0)

# Notch
c.setFillColor(colors.Color(0.15, 0.15, 0.15))
c.roundRect(ph_x + ph_w//2 - 12, ph_y + ph_h - 11, 24, 7, 3, fill=1, stroke=0)

# Person icon on screen
draw_person_icon(c, ph_x + ph_w//2 - 8, ph_y + ph_h*0.65, size=16)
draw_data_lines(c, ph_x + ph_w//2 + 4, ph_y + ph_h*0.66, 22)
draw_data_lines(c, ph_x + ph_w//2 + 4, ph_y + ph_h*0.58, 16)

# QR on screen
draw_qr_icon(c, ph_x + ph_w//2 - 18, ph_y + 22, size=36)

# Shadow
c.setStrokeColor(colors.Color(0.7,0.7,0.7))
c.setLineWidth(0.5)
c.setFillColor(colors.Color(0.85,0.85,0.85))
c.ellipse(ph_x+5, ph_y-5, ph_x+ph_w-5, ph_y+3, fill=1, stroke=0)

# Reference numbers
ref_label(c, ph_x + ph_w//2, ph_y + 40, 1, dx=45, dy=0)    # QR -> 1
ref_label(c, ph_x + ph_w//2 - 8, ph_y + ph_h*0.72, 4, dx=-45, dy=10)  # person -> 4
ref_label(c, ph_x + ph_w - 5, ph_y + ph_h*0.5, 5, dx=20, dy=0)  # screen -> 5

# Legend
c.setFont("Helvetica", 6.5)
c.drawString(50, fig2_top - 185, "1 - Código QR único    4 - Datos del titular    5 - Tarjeta digital (app móvil)")

# ============================================================
# FIG. 3 — Smartphone + Physical certificate side by side
# ============================================================
fig3_top = fig2_top - 215

c.setFont("Helvetica-Bold", 9)
c.drawString(50, fig3_top, "Fig. 3")

# --- Left: Smartphone ---
sp_x, sp_y = 110, fig3_top - 170
sp_w, sp_h = 70, 138

c.setStrokeColor(colors.black)
c.setFillColor(colors.Color(0.15, 0.15, 0.15))
c.setLineWidth(1.5)
c.roundRect(sp_x, sp_y, sp_w, sp_h, 9, fill=1, stroke=1)

c.setFillColor(colors.white)
c.roundRect(sp_x+4, sp_y+7, sp_w-8, sp_h-14, 5, fill=1, stroke=0)

c.setFillColor(colors.Color(0.15,0.15,0.15))
c.roundRect(sp_x + sp_w//2 - 10, sp_y + sp_h - 10, 20, 6, 3, fill=1, stroke=0)

# Inner card on phone
ic_x = sp_x + 6
ic_y = sp_y + 42
ic_w = sp_w - 12
ic_h = sp_h - 58
draw_rounded_rect(c, ic_x, ic_y, ic_w, ic_h, r=4, stroke_width=1)
draw_person_icon(c, ic_x + ic_w*0.3, ic_y + ic_h*0.7, size=12)
draw_data_lines(c, ic_x + ic_w*0.5, ic_y + ic_h*0.65, ic_w*0.4)
draw_data_lines(c, ic_x + ic_w*0.5, ic_y + ic_h*0.5, ic_w*0.3)
draw_qr_icon(c, ic_x + ic_w//2 - 13, ic_y + 4, size=26)

# Shadow
c.setFillColor(colors.Color(0.85,0.85,0.85))
c.ellipse(sp_x+5, sp_y-5, sp_x+sp_w-5, sp_y+3, fill=1, stroke=0)

# --- Right: Physical certificate ---
cert_x = sp_x + sp_w + 40
cert_y = sp_y + 15
cert_w = 100
cert_h = 115
draw_rounded_rect(c, cert_x, cert_y, cert_w, cert_h, r=5, stroke_width=2)
draw_person_icon(c, cert_x + cert_w*0.28, cert_y + cert_h*0.72, size=16)
draw_data_lines(c, cert_x + cert_w*0.48, cert_y + cert_h*0.72, cert_w*0.42)
draw_data_lines(c, cert_x + cert_w*0.48, cert_y + cert_h*0.58, cert_w*0.32)
draw_qr_icon(c, cert_x + cert_w//2 - 18, cert_y + 8, size=36)

# Reference numbers Fig. 3
ref_label(c, ic_x + ic_w//2, ic_y + 17, 1, dx=-35, dy=5)    # QR phone -> 1
ref_label(c, cert_x + cert_w//2, cert_y + 26, 1, dx=38, dy=5)  # QR cert -> 1
ref_label(c, sp_x + sp_w - 4, sp_y + sp_h*0.5, 5, dx=18, dy=0)   # phone screen -> 5
ref_label(c, cert_x + cert_w - 5, cert_y + cert_h*0.5, 6, dx=18, dy=0)  # physical cert -> 6

# Legend
c.setFont("Helvetica", 6.5)
c.drawString(50, fig3_top - 180, "1 - Código QR único    5 - Tarjeta digital (app móvil)    6 - Certificado de registro físico")

# Page number
c.setFont("Helvetica", 9)
c.drawCentredString(W/2, 25, "6")

c.save()
print("Done: figuras_corregidas.pdf")