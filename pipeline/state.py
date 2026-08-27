"""Series anchor, publish ledger, and preflight — the things that must survive a run.

Three ideas ported from the canonical rebuild, each fixing something this
implementation got wrong:

1. The week number came from a constant compiled into build.py. It now comes
   from state/series.json, anchored to the first *published* infographic, so
   the count reflects what the channel actually saw rather than what the code
   was told.
2. Nothing recorded that a week had been sent, so a re-run posted it twice.
   There is now a ledger, and publish refuses a week already in it.
3. Preflight lived in the routine's prompt as prose the model had to follow.
   It is now code with documented exit codes, so a failure names itself the
   same way every time instead of depending on how carefully a prompt was read.
"""
import datetime as dt
import importlib
import json
import os
import pathlib
import shutil
import urllib.error
import urllib.request

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE_DIR = REPO_ROOT / "state"
SERIES_FILE = STATE_DIR / "series.json"
SENT_FILE = STATE_DIR / "sent_weeks.json"
PREVIEW_FILE = STATE_DIR / "preview_log.json"
APPROVAL_FILE = STATE_DIR / "approvals.json"

# Exit codes. A number here is a contract with the routine: it reports the code
# and stops, rather than interpreting a failure it cannot see.
OK = 0
NO_PEARLS = 2
TOO_FEW_PEARLS = 3
ANCHOR_MISSING = 11
TOKENS_MISSING = 12
NOTION_UNREACHABLE = 13
TELEGRAM_UNREACHABLE = 14
DEPS_MISSING = 15
CHROMIUM_MISSING = 16
ALREADY_PUBLISHED = 17
NOT_APPROVED = 18


class PreflightError(RuntimeError):
    """Carries the exit code the routine should report."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


# --------------------------------------------------------------------------
# The series anchor
# --------------------------------------------------------------------------

class Series:
    """Where the week count starts, and where posts go."""

    def __init__(self, raw):
        try:
            self.anchor_date = dt.date.fromisoformat(raw["anchor_date"])
            self.anchor_week = int(raw["anchor_week"])
            self.review_chat_id = str(raw["review_chat_id"])
            self.channel_chat_id = str(raw["channel_chat_id"])
        except (KeyError, TypeError, ValueError) as e:
            raise PreflightError(ANCHOR_MISSING, f"{SERIES_FILE} is malformed: {e}")
        self.specialty = raw.get("specialty", "Cardiology")
        if self.anchor_date.weekday() != 0:
            raise PreflightError(
                ANCHOR_MISSING,
                f"anchor_date {self.anchor_date} is not a Monday; weeks run Mon-Sun")

    def week_for(self, monday):
        """Series week number for a week starting on `monday`."""
        if monday < self.anchor_date:
            raise PreflightError(
                ANCHOR_MISSING,
                f"week starting {monday} precedes the anchor {self.anchor_date}")
        return self.anchor_week + (monday - self.anchor_date).days // 7


def load_series():
    if not SERIES_FILE.exists():
        raise PreflightError(
            ANCHOR_MISSING,
            f"{SERIES_FILE} does not exist. Copy state/series.example.json to it "
            f"and set anchor_date to the Monday of the first published week.")
    try:
        return Series(json.loads(SERIES_FILE.read_text()))
    except json.JSONDecodeError as e:
        raise PreflightError(ANCHOR_MISSING, f"{SERIES_FILE} is not valid JSON: {e}")


# --------------------------------------------------------------------------
# Ledgers: what was previewed, what was published
# --------------------------------------------------------------------------

def _read(path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}


def _write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, sort_keys=True) + "\n")


def load_sent_weeks():
    return _read(SENT_FILE)


def already_published(week):
    return str(week) in load_sent_weeks()


def record_published(week, cards_hash, message_id):
    data = load_sent_weeks()
    data[str(week)] = {"cards_hash": cards_hash, "message_id": message_id,
                       "at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
    _write(SENT_FILE, data)


def load_preview_log():
    return _read(PREVIEW_FILE)


def record_preview(week, cards_hash, message_id):
    data = load_preview_log()
    data[str(week)] = {"cards_hash": cards_hash, "message_id": message_id,
                       "at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
    _write(PREVIEW_FILE, data)


def load_approvals():
    return _read(APPROVAL_FILE)


def record_approval(week, cards_hash, decision, by=None, update_id=None):
    """Remember a button tap. Keyed by week; the hash binds it to those cards."""
    data = load_approvals()
    data[str(week)] = {"cards_hash": cards_hash, "decision": decision, "by": by,
                       "update_id": update_id,
                       "at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
    _write(APPROVAL_FILE, data)


def approved(week, cards_hash):
    """Was *this* set of cards approved? A rewrite since the tap does not count."""
    entry = load_approvals().get(str(week))
    return bool(entry) and entry.get("decision") == "ok" \
        and entry.get("cards_hash") == cards_hash


def load_update_offset():
    return load_approvals().get("_offset")


def record_update_offset(offset):
    data = load_approvals()
    data["_offset"] = offset
    _write(APPROVAL_FILE, data)


def preview_matches(week, cards_hash):
    """Has this exact set of cards been previewed? publish requires yes."""
    entry = load_preview_log().get(str(week))
    return bool(entry) and entry.get("cards_hash") == cards_hash


# --------------------------------------------------------------------------
# Preflight
# --------------------------------------------------------------------------

def check_tokens(need_telegram=True):
    missing = [n for n in (["NOTION_TOKEN"] + (["TELEGRAM_BOT_TOKEN"] if need_telegram else []))
               if not os.environ.get(n)]
    if missing:
        raise PreflightError(TOKENS_MISSING, f"missing environment variable(s): {', '.join(missing)}")


def check_deps():
    for mod, pkg in (("qrcode", "qrcode"),):
        try:
            importlib.import_module(mod)
        except ImportError:
            raise PreflightError(
                DEPS_MISSING,
                f"python package {pkg!r} is not importable. "
                f"fix: pip install -r weekly-infographic/requirements.txt")


# Where a Chromium may live, besides CHROME_PATH. A module constant so the
# failure path is testable - an environment variable cannot hide a literal.
CHROMIUM_ROOTS = ["/opt/pw-browsers"]
CHROMIUM_NAMES = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]


def check_chromium():
    """Resolve Chromium the same way shoot.mjs does, and fail with what was tried."""
    tried = []
    env = os.environ.get("CHROME_PATH")
    if env:
        tried.append(env)
        if pathlib.Path(env).exists():
            return env
    roots = [os.environ.get("PLAYWRIGHT_BROWSERS_PATH"), *CHROMIUM_ROOTS,
             str(pathlib.Path.home() / ".cache/ms-playwright")]
    for root in filter(None, roots):
        tried.append(f"{root}/chromium*/chrome-linux/chrome")
        p = pathlib.Path(root)
        if not p.is_dir():
            continue
        for d in sorted(p.glob("chromium*"), reverse=True):
            for rel in ("chrome-linux/chrome", "chrome-linux/headless_shell"):
                if (d / rel).exists():
                    return str(d / rel)
    for name in CHROMIUM_NAMES:
        tried.append(name)
        found = shutil.which(name)
        if found:
            return found
    raise PreflightError(
        CHROMIUM_MISSING,
        "no Chromium found. searched: " + ", ".join(tried) +
        ". fix: set CHROME_PATH, or install chromium. Never install one mid-run.")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Refuse to follow redirects during a reachability probe.

    Returning None means "do not redirect", so urllib surfaces the 3xx as an
    HTTPError, which _reachable already reads as proof the host answered.
    Following it instead can walk off the allowlist - https://api.telegram.org/
    redirects to core.telegram.org, which no one allowlists, so the probe used
    to fail at that second CONNECT and blame the host we had just reached.
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _reachable(url, code, host):
    """A blocked host fails at the CONNECT tunnel, which reads like an outage."""
    try:
        opener = urllib.request.build_opener(_NoRedirect)
        req = urllib.request.Request(url, method="GET")
        opener.open(req, timeout=15)
    except urllib.error.HTTPError:
        return              # any status from the service means we reached it
    except Exception as e:
        raise PreflightError(
            code,
            f"{host} is not reachable ({type(e).__name__}: {e}). If this is a 403 at the "
            f"CONNECT tunnel the environment's network policy is refusing the host: set "
            f"Network access to Custom and add {host} to Allowed domains.")


def check_notion_reachable():
    _reachable("https://api.notion.com/v1/users/me", NOTION_UNREACHABLE, "api.notion.com")


def check_telegram_reachable():
    # Not the bare root: it 302s to core.telegram.org. This path is answered
    # by the API itself (401), needs no token, and never redirects.
    _reachable("https://api.telegram.org/bot0:0/getMe",
               TELEGRAM_UNREACHABLE, "api.telegram.org")


def preflight(need_telegram=True, need_render=True, network=True):
    """Run every check in order, cheapest and most-diagnostic first."""
    series = load_series()
    check_tokens(need_telegram=need_telegram)
    if need_render:
        check_deps()
        check_chromium()
    if network:
        check_notion_reachable()
        if need_telegram:
            check_telegram_reachable()
    return series
