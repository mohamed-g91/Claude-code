"""
renderer.py — Jinja2 HTML -> Playwright Chromium -> PNG.

Idempotent: if the PNG for this week exists and the rendered HTML would be
byte-identical to the last render (tracked via a hash sidecar), return the
existing path untouched. Otherwise render and overwrite.

If Chromium is missing, raise RenderError with the paths searched. We never
install a browser.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from pipeline.state import REPO_ROOT, WORK_DIR

TEMPLATES_DIR = REPO_ROOT / "templates"
PNG_WIDTH = 1080
PNG_HEIGHT = 1920  # Telegram-friendly portrait; full-page screenshot may exceed


class RenderError(RuntimeError):
    """Raised on any rendering failure. Message is what gets reported."""


@dataclass(frozen=True)
class CardRender:
    """A card formatted for the template."""

    index: int          # 1-based position on the infographic
    visible: str        # gate-passed card text
    html: str           # emphasis spans converted to <strong>
    flags: list[str]    # Pass B rule names, e.g. ["QUALIFIER_DROPPED"]


def spans_to_html(visible: str, span_ranges: list[tuple[int, int]]) -> str:
    """Convert (start, end) ranges into <strong> markup without re-parsing."""
    out: list[str] = []
    cursor = 0
    for start, end in sorted(span_ranges):
        if start < cursor:
            continue  # overlapping spans shouldn't happen; skip defensively
        out.append(visible[cursor:start])
        out.append("<strong>")
        out.append(visible[start:end])
        out.append("</strong>")
        cursor = end
    out.append(visible[cursor:])
    return "".join(out)


def load_cards(path: Path) -> list[CardRender]:
    """Load work/cards.json into CardRender objects."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    cards = []
    for i, c in enumerate(raw["cards"], start=1):
        cards.append(
            CardRender(
                index=i,
                visible=c["visible"],
                html=spans_to_html(c["visible"], [tuple(r) for r in c.get("span_ranges", [])]),
                flags=list(c.get("flags", [])),
            )
        )
    return cards


def render_png(week: int, cards: list[CardRender], title: str = "MRCP Pearls") -> Path:
    """Render the weekly PNG. Returns the output path.

    Idempotency: hash of the (title + cards) input is stored beside the PNG;
    a byte-identical input short-circuits to the cached file.
    """
    png_path = WORK_DIR / f"infographic_{week}.png"
    hash_path = WORK_DIR / f"infographic_{week}.sha256"

    payload = json.dumps(
        {"week": week, "title": title, "cards": [c.__dict__ for c in cards]},
        sort_keys=True,
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()

    if png_path.exists() and hash_path.exists() and hash_path.read_text().strip() == digest:
        return png_path, True  # cached, no work

    html = _render_html(title=title, week=week, cards=cards)
    _screenshot(html, png_path)
    hash_path.write_text(digest)
    return png_path, False


def _render_html(title: str, week: int, cards: list[CardRender]) -> str:
    from jinja2 import Environment, FileSystemLoader, select_autoescape

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    # `card.html` is pre-escaped content built from gate-passed text; mark safe.
    template = env.get_template("infographic.html.j2")
    return template.render(title=title, week=week, cards=cards)


def _screenshot(html: str, out_path: Path) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise RenderError(f"playwright not installed: {e}") from e

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    tmp_html = WORK_DIR / "_render_tmp.html"
    tmp_html.write_text(html, encoding="utf-8")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": PNG_WIDTH, "height": PNG_HEIGHT})
            page.goto(tmp_html.as_uri())
            page.wait_for_timeout(300)  # let web fonts settle
            page.screenshot(path=str(out_path), full_page=True)
            browser.close()
    except Exception as e:
        msg = str(e)
        if "Executable doesn't exist" in msg or "BrowserType" in msg:
            searched = REPO_ROOT / ".cache" / "ms-playwright"
            raise RenderError(
                f"PREFLIGHT FAIL: Chromium not installed for Playwright\n"
                f"expected path: {searched}\n"
                f"fix: playwright install chromium\n"
                f"detail: {msg[:200]}"
            ) from e
        raise RenderError(f"render failed: {msg[:300]}") from e
