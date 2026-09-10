// The local server, for reading the site the way a browser reads it.
//
//   node tools/serve.mjs [port]        # npm run serve
//
// `fetch` is blocked on file://, so the deck pages cannot load cases.json when
// the folder is opened directly -- serving it is not a nicety, it is the only
// way the pages work locally.
//
// This used to be `python3 -m http.server`, which is one word too specific:
// Windows installs the interpreter as `python` or `py`, so the script failed
// on the machine the case videos are filmed on. Node is already required to
// run the tests, so serving with it removes a dependency rather than adding
// one, and `npm run serve` now means the same thing on every platform.

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(join(import.meta.dirname, ".."));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8000);

// Enough for what the site is made of. An unknown extension is served as
// bytes rather than guessed at: a wrong Content-Type on a script is a silent
// failure in the browser, and octet-stream at least fails loudly.
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
};

// Everything under the repo, nothing above it. The path is normalised before
// the check so that a request for /../../etc/passwd is rejected rather than
// resolved -- this listens on loopback only, but a traversal hole is not the
// kind of thing to leave in on the grounds that it is hard to reach.
function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const full = resolve(join(ROOT, normalize(decoded)));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

function fileToServe(path) {
  try {
    // A directory means the index inside it, the same as any static host: the
    // wordmark links to "index.html" but a reader types the bare origin.
    return statSync(path).isDirectory() ? join(path, "index.html") : path;
  } catch {
    return path;
  }
}

const server = createServer((req, res) => {
  const path = safePath(req.url ?? "/");
  if (!path) {
    res.writeHead(403, { "Content-Type": "text/plain" }).end("Forbidden\n");
    return;
  }

  const file = fileToServe(path);
  const stream = createReadStream(file);

  stream.on("open", () => {
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      // No caching. The whole point of running this is to see the edit you
      // just made; a cached game.js once had a fix reported as still broken.
      "Cache-Control": "no-store",
    });
    stream.pipe(res);
  });

  stream.on("error", () => {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found\n");
  });
});

// Loopback only. This serves the unpublished deck -- every pivot and
// resolution of the cases still in preparation -- and there is no reason for
// that to be reachable from the network the laptop happens to be on.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Serving ${ROOT}`);
  console.log(`  http://127.0.0.1:${PORT}/            the landing page`);
  console.log(`  http://127.0.0.1:${PORT}/record.html one case, for filming`);
  console.log("Stop with Ctrl+C.");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Either stop what is on it, or pick ` +
        `another: npm run serve -- 8001`
    );
    process.exit(1);
  }
  throw err;
});
