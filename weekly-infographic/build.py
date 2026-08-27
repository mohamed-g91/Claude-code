#!/usr/bin/env python3
"""Build the weekly pearls infographic (dark + light) from one source of truth.

Content comes from a JSON file (--content) so the pipeline can drive this
unattended; with no arguments it falls back to the committed sample so a human
can still run it by hand. Everything you'd want to tweak lives in CONFIG or in
that JSON. Everything below it is mechanics.
"""
import argparse, datetime as dt, json, os, pathlib, random, sys, qrcode

# ============================ CONFIG ============================
# Defaults. A --content JSON may override brand, specialty, week_start and pearls.
BRAND = {
    "handle":  "@mrcp_gafar",                # shown in the footer
    "url":     "https://t.me/mrcp_gafar",    # what the QR encodes
    "url_txt": "t.me/mrcp_gafar",            # shown under the handle
    "author":  "Dr. Mohamed Gafar, MRCP UK", # <-- your name, other side
}
SPECIALTY  = "Cardiology"
WEEK_START = dt.date(2026, 8, 21)            # Friday of the week being summarised
WEEK_NUMBER = 1                              # only used by the built-in sample
# Canvas height by pearl count. Seven pearls never fit 1350px at a size legible
# on a phone - the fitter just shrank the text instead of saying so. Telegram
# scales an image to the chat width and does not crop, so a taller canvas costs
# nothing and keeps every pearl.
CANVAS_H = {3: 1350, 4: 1400, 5: 1560, 6: 1800, 7: 1980, 8: 2180}
ACCENTS = {                                  # per-card accent, per theme
  "dark":  ["#00E0B4","#5E7CFF","#FFB443","#FF6B8A","#3FC4FF","#A78BFA"],
  "light": ["#0B7A63","#3D51D6","#9A5D0F","#C92C55","#0A6A91","#6B3FD4"],
}
MIN_PEARLS, MAX_PEARLS = 3, 8                # fewer than MIN is not worth a post
# ================================================================

# The sample week, used when no --content is given.
SAMPLE = [
  {"topic":"Heart failure","src":"NICE NG106",
   "text":"**NT-proBNP > 2000 ng/L** \u2192 specialist assessment and echo within **2 weeks**."},
  {"topic":"Pre-eclampsia","src":"NICE NG133",
   "text":"**Aspirin 75\u2013150 mg** daily from **12 weeks** \u2014 one high-risk or two moderate-risk factors."},
  {"topic":"Hyperlipidaemia","src":"NICE NG238",
   "text":"**QRISK3 \u2265 10%** \u2192 **atorvastatin 20 mg** for primary prevention."},
  {"topic":"Atrial fibrillation","src":"NICE NG196",
   "text":"**CHA\u2082DS\u2082-VASc \u2265 2** in men, **\u2265 3** in women \u2014 offer anticoagulation."},
  {"topic":"Aortic stenosis","src":"ESC 2021",
   "text":"Severe: **area < 1.0 cm\u00b2**, mean gradient **> 40 mmHg**, peak velocity **> 4 m/s**."},
  {"topic":"Torsades de pointes","src":"RCUK",
   "text":"**Magnesium sulfate 2 g IV** over **10 minutes** \u2014 regardless of serum magnesium."},
]

# The headline names the count, so it has to agree with what is on the canvas.
NUMBER_WORD = {3:"three", 4:"four", 5:"five", 6:"six", 7:"seven", 8:"eight"}

def iso_week(d):
    """Still used as a stable key for records - it never collides across years."""
    return d.isocalendar()[1]

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

def build(theme, cfg):
    brand, pearls = cfg["brand"], cfg["pearls"]
    start = cfg["week_start"]; end = start + dt.timedelta(days=6)
    # The week number comes from state/series.json via the content JSON.
    # It used to be recomputed here from a second epoch constant, which
    # meant the number on the image could disagree with everything else.
    ctx = {"n": cfg["week"], "range": fmt_range(start, end), **brand}
    # Accents cycle, so a week with more pearls than colours still gets one each.
    accents = [ACCENTS[theme][i % len(ACCENTS[theme])] for i in range(len(pearls))]
    count = NUMBER_WORD.get(len(pearls), str(len(pearls)))
    height = int(os.environ.get("CANVAS_H") or CANVAS_H.get(len(pearls), 1350))
    return f'''<meta charset="utf-8"><link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="weekly.css">
<meta name="canvas-height" content="{height}">
<script>document.documentElement.style.setProperty('--canvas-h','{height}px');
document.documentElement.setAttribute('data-theme','{theme}');
window.ACCENTS={json.dumps(accents)};window.CTX={json.dumps(ctx)};</script>
{plate_svg()}
{WATERMARK}
<div class="head">
  <div><span class="chip">{cfg["specialty"]}</span></div>
  <div class="wknum">Week<b id="wk"></b><div class="wkrule"></div></div>
</div>
<h1>This week&rsquo;s<br><span>{count} pearls.</span></h1>
{ecg_svg()}
<div class="list" id="list"></div>
<footer>
  <div class="brand">
    <div class="qr">{qr_svg(brand["url"])}</div>
    <div class="brandtxt"><b id="hd"></b><span id="hu"></span></div>
  </div>
  <div class="byline">
    <b id="au"></b><span><i>Guideline-checked</i> &middot; <span id="rg"></span></span>
  </div>
</footer>
<script src="content.js"></script><script src="icons.js"></script><script src="weekly.js"></script>'''


def load_config(path):
    """Resolve the render config from a --content JSON, falling back to CONFIG.

    Fails loudly on anything the renderer cannot honour, because a silent
    fallback here would publish last week's sample under this week's number.
    """
    cfg = {"brand": dict(BRAND), "specialty": SPECIALTY, "week": WEEK_NUMBER,
           "week_start": WEEK_START, "pearls": list(SAMPLE)}
    if path:
        raw = json.loads(pathlib.Path(path).read_text())
        cfg["brand"].update(raw.get("brand", {}))
        cfg["specialty"] = raw.get("specialty", cfg["specialty"])
        if "week_start" in raw:
            cfg["week_start"] = dt.date.fromisoformat(raw["week_start"])
        if "pearls" in raw:
            cfg["pearls"] = raw["pearls"]
        if "week" in raw:
            cfg["week"] = int(raw["week"])
    if cfg["week_start"].weekday() != 4:
        sys.exit(f"week_start {cfg['week_start']} is not a Friday")
    if cfg["week"] < 1:
        sys.exit(f"week {cfg['week']} is not a positive series week number")
    n = len(cfg["pearls"])
    if not MIN_PEARLS <= n <= MAX_PEARLS:
        sys.exit(f"{n} pearls: need {MIN_PEARLS}-{MAX_PEARLS}")
    for i, pearl in enumerate(cfg["pearls"]):
        # src is optional: the bank carries no guideline reference, and the card
        # hides the line rather than printing an empty one.
        if not pearl.get("topic"):
            sys.exit(f"pearl {i}: missing topic")
        if not pearl.get("text") and not (pearl.get("lead") and pearl.get("rest")):
            sys.exit(f"pearl {i}: needs text (or legacy lead + rest)")
        pearl.setdefault("src", "")
    return cfg


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--content", help="JSON with brand/specialty/week_start/pearls")
    ap.add_argument("--outdir", default=".", help="where to write the HTML and content.js")
    args = ap.parse_args()

    cfg = load_config(args.content)
    out = pathlib.Path(args.outdir); out.mkdir(parents=True, exist_ok=True)
    # content.js is generated, not hand-edited: the JSON is the only source of truth.
    (out / "content.js").write_text("const PEARLS = " + json.dumps(cfg["pearls"], ensure_ascii=False) + ";\n")
    for theme in ("dark", "light"):
        (out / f"weekly_{theme}.html").write_text(build(theme, cfg))
        print(f"wrote {out / f'weekly_{theme}.html'}")
    end = cfg["week_start"] + dt.timedelta(days=6)
    h = int(os.environ.get("CANVAS_H") or CANVAS_H.get(len(cfg["pearls"]), 1350))
    print(f"canvas 1080x{h}")
    print(f"Week {cfg['week']} (ISO {iso_week(cfg['week_start'])}) "
          f"\u00b7 {fmt_range(cfg['week_start'], end)} \u00b7 {len(cfg['pearls'])} pearls")


if __name__ == "__main__":
    main()
