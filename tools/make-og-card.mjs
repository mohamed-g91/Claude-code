#!/usr/bin/env node
// Renders tools/og-card.html to src/og-card.png -- the image a chat app shows
// when someone pastes a link to this site.
//
//   node tools/make-og-card.mjs
//
// Run by hand, and the PNG is committed. Not part of the Pages build on
// purpose: a runner's font set is not this machine's, so generating it there
// would silently reflow the wordmark on some future deploy. Rendering once and
// committing the result means what was reviewed is what ships.
//
// Set PW_CHROMIUM to a Chromium binary if Playwright's bundled one is absent.

import { chromium } from "playwright";
import { globSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

// Open Graph consumers expect 1.91:1. Twitter's summary_large_image, Facebook
// and WhatsApp all read this size without re-cropping.
const WIDTH = 1200;
const HEIGHT = 630;

// WhatsApp drops a card whose image is slow to fetch, so this is a real
// ceiling rather than tidiness.
const MAX_BYTES = 300 * 1024;

const root = join(import.meta.dirname, "..");
const source = join(root, "tools", "og-card.html");
const out = join(root, "src", "og-card.png");

const executablePath =
  process.env.PW_CHROMIUM ??
  globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome")[0];

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  // A PNG has one appearance. Without pinning this, whoever runs the script
  // decides whether the card ships light or dark.
  colorScheme: "light",
  // Chat clients scale the card down far more often than up, so a 1x render at
  // the exact target size is what they want; 2x would only cost bytes.
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(source).href);
// The card is one screenshot of static markup, but brand.css is a real
// stylesheet request -- wait for it rather than racing it.
await page.waitForLoadState("networkidle");

await page.screenshot({ path: out, type: "png" });
await browser.close();

const { size } = statSync(out);
const kb = (size / 1024).toFixed(1);
if (size > MAX_BYTES) {
  console.error(`${out}\n  ${kb} KB exceeds the ${MAX_BYTES / 1024} KB budget -- clients drop slow cards.`);
  process.exit(1);
}
console.log(`Wrote ${out}\n  ${WIDTH}x${HEIGHT}, ${kb} KB`);
