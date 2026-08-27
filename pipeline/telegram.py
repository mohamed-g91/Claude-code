"""Send the rendered infographic for review, and publish it once approved.

Nothing here posts to the channel without an explicit --to channel, and the
default for every entry point is a dry run that prints the request instead of
making it. Publishing is one-way and public; it should take a deliberate act.
"""
import json
import os
import urllib.error
import urllib.request
import uuid

API = "https://api.telegram.org"


def _multipart(fields, files):
    boundary = uuid.uuid4().hex
    body = b""
    for k, v in fields.items():
        body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n"
                 f"{v}\r\n").encode()
    for k, (name, blob) in files.items():
        body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"; "
                 f"filename=\"{name}\"\r\nContent-Type: image/png\r\n\r\n").encode()
        body += blob + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def _call(method, params, token=None, timeout=30):
    token = token or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    req = urllib.request.Request(
        f"{API}/bot{token}/{method}", data=json.dumps(params).encode(),
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        # Telegram puts the reason in the body; without it a 400 says nothing.
        raise RuntimeError(f"{method} failed: {e.code} "
                           f"{e.read()[:300].decode(errors='replace')}") from None


def review_keyboard(week, cards_hash):
    """Approve / needs-changes buttons, bound to this exact set of cards.

    The card hash rides in the callback data so a button on last week's photo,
    or on a preview that has since been rewritten, cannot approve what is on
    screen now. Telegram allows 64 bytes; this uses about 25.
    """
    tag = f"wk:{week}:{cards_hash}"
    return {"inline_keyboard": [[
        {"text": "✅ Approve", "callback_data": f"{tag}:ok"},
        {"text": "✍️ Needs changes", "callback_data": f"{tag}:no"}]]}


def get_updates(offset=None, token=None, wait=0, allowed=("callback_query",)):
    """Collect pending updates. Long-polls for `wait` seconds if asked.

    There is no webhook on this bot, so button taps queue here and Telegram
    keeps them for 24 hours - a tap is picked up by the next run rather than
    instantly. If a webhook is ever set (an n8n Telegram trigger), this stops
    working and the trigger owns the updates instead.
    """
    params = {"timeout": wait, "allowed_updates": list(allowed)}
    if offset is not None:
        params["offset"] = offset
    return _call("getUpdates", params, token, timeout=wait + 30)


def answer_callback(callback_id, text, token=None):
    """Stop the button's spinner and show the operator a toast."""
    return _call("answerCallbackQuery",
                 {"callback_query_id": callback_id, "text": text}, token)


def settle_message(chat_id, message_id, caption, token=None):
    """Replace the caption and drop the keyboard, so a decision is taken once.

    editMessageCaption removes the inline keyboard by omitting reply_markup, so
    one call does both. Following it with editMessageReplyMarkup would be a
    no-op, and Telegram rejects no-op edits with a 400.
    """
    try:
        return _call("editMessageCaption",
                     {"chat_id": str(chat_id), "message_id": message_id,
                      "caption": caption, "parse_mode": "HTML"}, token)
    except RuntimeError as e:
        if "message is not modified" in str(e):
            return {"ok": True, "unchanged": True}
        raise


def copy_message(from_chat_id, message_id, to_chat_id, caption, token=None,
                 dry_run=True):
    """Republish the approved message itself, rather than re-uploading a file.

    The photo already lives on Telegram's servers, so this publishes the exact
    bytes that were reviewed and approved - it cannot drift from what was on
    screen, and it does not depend on a PNG still existing in some container.
    copyMessage sends a fresh post with no "forwarded from" header, and takes
    its own caption, so the preview disclaimer does not travel with it.
    """
    if dry_run:
        return {"dry_run": True, "method": "copyMessage", "chat_id": str(to_chat_id),
                "from_chat_id": str(from_chat_id), "message_id": message_id,
                "caption": caption, "reply_markup": None,
                "token_present": bool(token or os.environ.get("TELEGRAM_BOT_TOKEN"))}
    return _call("copyMessage",
                 {"chat_id": str(to_chat_id), "from_chat_id": str(from_chat_id),
                  "message_id": message_id, "caption": caption,
                  "parse_mode": "HTML"}, token)


def send_photo(png_path, chat_id, caption, token=None, dry_run=True, buttons=None):
    """Post the PNG. Returns the API response, or the planned request if dry.

    `buttons` is the reply_markup dict from review_keyboard(), or None for a
    plain photo. The channel post never carries one.
    """
    token = token or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    fields = {"chat_id": str(chat_id), "caption": caption, "parse_mode": "HTML"}
    if buttons:
        fields["reply_markup"] = json.dumps(buttons)

    if dry_run or not token:
        return {"dry_run": True, "method": "sendPhoto", "chat_id": str(chat_id),
                "caption": caption, "photo_bytes": os.path.getsize(png_path),
                "reply_markup": fields.get("reply_markup"),
                "token_present": bool(token)}

    with open(png_path, "rb") as f:
        body, ctype = _multipart(fields, {"photo": (os.path.basename(png_path), f.read())})
    req = urllib.request.Request(f"{API}/bot{token}/sendPhoto", data=body,
                                 headers={"Content-Type": ctype})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)
