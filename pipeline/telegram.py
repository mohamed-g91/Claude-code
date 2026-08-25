"""Send the rendered infographic for review, and publish it once approved.

Nothing here posts to the channel without an explicit --to channel, and the
default for every entry point is a dry run that prints the request instead of
making it. Publishing is one-way and public; it should take a deliberate act.
"""
import json
import os
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


def send_photo(png_path, chat_id, caption, token=None, dry_run=True, buttons=True):
    """Post the PNG. Returns the API response, or the planned request if dry."""
    token = token or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    fields = {"chat_id": str(chat_id), "caption": caption, "parse_mode": "HTML"}
    if buttons:
        # Review keyboard. A callback needs a listener (the n8n Telegram trigger);
        # without one these render but do nothing, so only attach them for review.
        fields["reply_markup"] = json.dumps({"inline_keyboard": [[
            {"text": "✅ Publish", "callback_data": "weekly:publish"},
            {"text": "🔁 Regenerate", "callback_data": "weekly:regen"},
            {"text": "✖️ Cancel", "callback_data": "weekly:cancel"}]]})

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
