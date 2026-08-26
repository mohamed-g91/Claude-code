#!/usr/bin/env python3
"""Build the weekly pearls infographic (dark + light) from one source of truth.

Everything you'd want to tweak lives in CONFIG. Everything below it is mechanics.
"""
import datetime as dt, json, pathlib, random, qrcode

# ============================ CONFIG ============================
BRAND = {
    "handle":  "@mrcp_gafar",                # shown in the footer
    "url":     "https://t.me/mrcp_gafar",    # what the QR encodes
    "url_txt": "t.me/mrcp_gafar",            # shown under the handle
    "author":  "Dr. Mohamed Gafar, MRCP UK", # <-- your name, other side
}
SPECIALTY  = "Cardiology"
WEEK_START = dt.date(2026, 8, 18)            # Monday of the week being summarised
ACCENTS = {                                  # per-card accent, per theme
  "dark":  ["#00E0B4","#5E7CFF","#FFB443","#FF6B8A","#3FC4FF","#A78BFA"],
  "light": ["#0B7A63","#3D51D6","#9A5D0F","#C92C55","#0A6A91","#6B3FD4"],
}
# ================================================================

# Week number rule: ISO-8601. Week 1 is the week containing the first Thursday
# of the year, weeks run Monday-Sunday. Same rule Python, Postgres and n8n use,
# so the number never has to be maintained by hand.
def iso_week(d): return d.isocalendar()[1]

WEEK_END = WEEK_START + dt.timedelta(days=6)
def fmt_range(a, b):
    if a.month == b.month: return f"{a.day} – {b.day} {b:%B %Y}"
    return f"{a.day} {a:%b} – {b.day} {b:%b} {b:%Y}"

def qr_svg(url):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=1, border=0)
    q.add_data(url); q.make(fit=True)
    m = q.get_matrix(); n = len(m)
    rects = "".join(f'<rect x="{x}" y="{y}" width="1" height="1"/>'
                    for y, row in enumerate(m) for x, v in enumerate(row) if v)
    return (f'<svg viewBox="0 0 {n} {n}" fill="var(--qr-ink)" '
            f'role="img" aria-label="Telegram channel QR">{rects}</svg>')

def ecg_svg(width=960, mid=39, beats=5):
    bw = width / beats; pts = []
    for b in range(beats):
        x = b * bw
        for fx, fy in [(0,0),(.10,0),(.15,-.22),(.20,0),(.30,0),(.34,.16),(.38,-.95),
                       (.42,.55),(.46,0),(.60,0),(.70,-.34),(.80,0),(1.0,0)]:
            pts.append(f"{x+fx*bw:.1f},{mid+fy*mid:.1f}")
    return f'''<svg class="ecg" viewBox="0 0 960 78" preserveAspectRatio="none">
  <defs><linearGradient id="eg" x1="0" x2="1">
      <stop offset="0" stop-color="var(--accent-1)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient>
    <filter id="glow" x="-20%" y="-60%" width="140%" height="220%">
      <feGaussianBlur stdDeviation="3.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <polyline fill="none" stroke="url(#eg)" stroke-width="2.7" stroke-linejoin="round"
    stroke-linecap="round" filter="url(#glow)" points="{" ".join(pts)}"/></svg>'''

HEART = ('<path d="M12 20.6C6 16.6 3.2 13.2 3.2 9.8A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 8.8 2.4'
         'c0 3.4-2.8 6.8-8.8 10.8Z"/>')

def plate_svg(seed=7):
    random.seed(seed)
    dots = "".join(f'<circle cx="{random.uniform(0,1080):.0f}" cy="{random.uniform(0,470):.0f}" '
                   f'r="{random.uniform(.8,2.5):.1f}" fill="var(--dot)" '
                   f'opacity="{random.uniform(.06,.28):.2f}"/>' for _ in range(140))
    arcs = "".join(f'<circle cx="880" cy="80" r="{r}" fill="none" stroke="url(#pg)" stroke-width="1.15" '
                   f'opacity="{max(.05,.40-i*.05):.2f}"/>' for i, r in enumerate(range(90,560,62)))
    return f'''<div class="plate" data-decor>
  <svg viewBox="0 0 1080 470" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%">
    <defs>
      <radialGradient id="g1" cx="17%" cy="5%" r="63%">
        <stop offset="0" stop-color="var(--plate-1)" stop-opacity="var(--plate-1o)"/>
        <stop offset="1" stop-color="var(--plate-1)" stop-opacity="0"/></radialGradient>
      <radialGradient id="g2" cx="89%" cy="0%" r="67%">
        <stop offset="0" stop-color="var(--plate-2)" stop-opacity="var(--plate-2o)"/>
        <stop offset="1" stop-color="var(--plate-2)" stop-opacity="0"/></radialGradient>
      <radialGradient id="g3" cx="56%" cy="89%" r="54%">
        <stop offset="0" stop-color="var(--plate-3)" stop-opacity="var(--plate-3o)"/>
        <stop offset="1" stop-color="var(--plate-3)" stop-opacity="0"/></radialGradient>
      <linearGradient id="pg" x1="0" x2="1">
        <stop offset="0" stop-color="var(--accent-1)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient>
    </defs>
    <rect width="1080" height="470" fill="var(--plate-base)"/>
    <rect width="1080" height="470" fill="url(#g1)"/>
    <rect width="1080" height="470" fill="url(#g2)"/>
    <rect width="1080" height="470" fill="url(#g3)"/>
    {arcs}{dots}
    <g transform="translate(690 40) scale(17)" fill="none" stroke="var(--ink)"
       stroke-opacity=".12" stroke-width="0.34" stroke-linejoin="round">{HEART}</g>
  </svg><div class="scrim"></div></div>'''

WATERMARK = (f'<div class="bgart" data-decor><svg class="watermark" viewBox="0 0 24 24" fill="none" '
             f'stroke="currentColor" stroke-width="0.30" stroke-linejoin="round">{HEART}</svg></div>')

def build(theme):
    wk = iso_week(WEEK_START)
    ctx = {"n": wk, "range": fmt_range(WEEK_START, WEEK_END), **BRAND}
    return f'''<meta charset="utf-8"><link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="weekly.css">
<script>document.documentElement.setAttribute('data-theme','{theme}');
window.ACCENTS={json.dumps(ACCENTS[theme])};window.CTX={json.dumps(ctx)};</script>
{plate_svg()}
{WATERMARK}
<div class="head">
  <div><span class="chip">{SPECIALTY}</span></div>
  <div class="wknum">Week<b id="wk"></b><div class="wkrule"></div></div>
</div>
<h1>This week&rsquo;s<br><span>six pearls.</span></h1>
{ecg_svg()}
<div class="list" id="list"></div>
<footer>
  <div class="brand">
    <div class="qr">{qr_svg(BRAND["url"])}</div>
    <div class="brandtxt"><b id="hd"></b><span id="hu"></span></div>
  </div>
  <div class="byline">
    <b id="au"></b><span><i>Guideline-checked</i> &middot; <span id="rg"></span></span>
  </div>
</footer>
<script src="content.js"></script><script src="icons.js"></script><script src="weekly.js"></script>'''

for theme in ("dark", "light"):
    pathlib.Path(f"weekly_{theme}.html").write_text(build(theme))
    print(f"wrote weekly_{theme}.html")
print(f"ISO week {iso_week(WEEK_START)} · {fmt_range(WEEK_START, WEEK_END)}")
