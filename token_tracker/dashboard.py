"""Render a self-contained, offline HTML dashboard from usage records.

The output is a single .html file with no external dependencies (no CDN
scripts, no network calls) -- open it directly in a browser. All charts are
hand-built inline SVG and all filtering/sorting runs client-side over the
embedded JSON payload.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .models import UsageRecord

MAX_EMBEDDED_RECORDS = 5000


def render_dashboard(
    records: list[UsageRecord],
    output_path: str | Path,
    *,
    title: str = "Claude Token Tracker",
) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    ordered = sorted(records, key=lambda r: r.timestamp, reverse=True)
    embedded = ordered[:MAX_EMBEDDED_RECORDS]
    truncated = len(ordered) - len(embedded)

    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "truncated": truncated,
        "records": [_record_to_dict(r) for r in embedded],
    }

    html = _TEMPLATE.replace("__TITLE__", title).replace(
        "__DATA_JSON__", json.dumps(payload, separators=(",", ":"))
    )
    output_path.write_text(html, encoding="utf-8")
    return output_path


def _record_to_dict(r: UsageRecord) -> dict:
    return {
        "source": r.source,
        "session_id": r.session_id,
        "project": r.project,
        "timestamp": r.timestamp,
        "model": r.model,
        "input_tokens": r.input_tokens,
        "output_tokens": r.output_tokens,
        "cache_creation_input_tokens": r.cache_creation_input_tokens,
        "cache_read_input_tokens": r.cache_read_input_tokens,
        "thinking_tokens": r.thinking_tokens,
        "service_tier": r.service_tier,
        "speed": r.speed,
        "effort": r.effort,
        "inference_geo": r.inference_geo,
        "cost_usd": r.cost_usd,
        "request_id": r.request_id,
        "raw_usage": r.raw_usage(),
    }


_TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>__TITLE__</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #f7f7f8;
    --surface: #ffffff;
    --border: #e2e2e6;
    --text: #1b1b1f;
    --text-muted: #6b6b76;
    --accent: #5b5bd6;
    --accent-soft: #ecebfd;
    --input-color: #4c6ef5;
    --output-color: #f76707;
    --cache-w-color: #37b24d;
    --cache-r-color: #ae3ec9;
    --thinking-color: #f59f00;
    --shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 8px rgba(0,0,0,0.04);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #16161a;
      --surface: #1e1e24;
      --border: #313138;
      --text: #ececef;
      --text-muted: #9c9ca6;
      --accent: #9797f5;
      --accent-soft: #2a2a45;
      --shadow: 0 1px 2px rgba(0,0,0,0.3), 0 1px 8px rgba(0,0,0,0.25);
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    padding: 24px;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 0 0 12px; color: var(--text); }
  .meta { color: var(--text-muted); font-size: 12.5px; margin-bottom: 20px; }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
    box-shadow: var(--shadow);
  }
  .card .label { color: var(--text-muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; }
  .card .value { font-size: 20px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    box-shadow: var(--shadow);
    margin-bottom: 20px;
    overflow-x: auto;
  }
  .filters { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; align-items: end; }
  .filters label { display: flex; flex-direction: column; font-size: 11.5px; color: var(--text-muted); gap: 4px; }
  .filters select, .filters input {
    background: var(--surface); color: var(--text); border: 1px solid var(--border);
    border-radius: 6px; padding: 6px 8px; font-size: 13px; min-width: 140px;
  }
  .legend { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; font-size: 12px; color: var(--text-muted); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  table { border-collapse: collapse; width: 100%; font-size: 12.5px; min-width: 720px; }
  th, td { text-align: right; padding: 6px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) { text-align: left; }
  th { color: var(--text-muted); font-weight: 600; cursor: pointer; user-select: none; position: sticky; top: 0; background: var(--surface); }
  th:hover { color: var(--accent); }
  tbody tr:hover { background: var(--accent-soft); cursor: pointer; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .detail-row td { text-align: left; background: var(--accent-soft); white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 11.5px; }
  .muted { color: var(--text-muted); }
  .scroll-table { max-height: 480px; overflow-y: auto; }
  .bar-chart, .line-chart { width: 100%; height: auto; overflow: visible; }
  .axis-label { font-size: 10px; fill: var(--text-muted); }
  .bar-label { font-size: 10px; fill: var(--text-muted); }
</style>
</head>
<body>
  <h1>__TITLE__</h1>
  <div class="meta" id="meta"></div>

  <div class="filters">
    <label>Source
      <select id="f-source"><option value="">All</option></select>
    </label>
    <label>Model
      <select id="f-model"><option value="">All</option></select>
    </label>
    <label>Session / project contains
      <input id="f-search" type="text" placeholder="e.g. my-app">
    </label>
    <label>From
      <input id="f-from" type="date">
    </label>
    <label>To
      <input id="f-to" type="date">
    </label>
  </div>

  <div class="cards" id="cards"></div>

  <div class="panel">
    <h2>Tokens by model</h2>
    <div class="legend">
      <span><i class="swatch" style="background:var(--input-color)"></i>Input</span>
      <span><i class="swatch" style="background:var(--output-color)"></i>Output</span>
      <span><i class="swatch" style="background:var(--cache-w-color)"></i>Cache write</span>
      <span><i class="swatch" style="background:var(--cache-r-color)"></i>Cache read</span>
      <span><i class="swatch" style="background:var(--thinking-color)"></i>Thinking (subset of output)</span>
    </div>
    <svg class="bar-chart" id="model-chart"></svg>
  </div>

  <div class="panel">
    <h2>Tokens per day</h2>
    <div class="legend">
      <span><i class="swatch" style="background:var(--input-color)"></i>Input</span>
      <span><i class="swatch" style="background:var(--output-color)"></i>Output</span>
    </div>
    <svg class="line-chart" id="day-chart"></svg>
  </div>

  <div class="panel">
    <h2>Sessions</h2>
    <div class="scroll-table">
      <table id="session-table">
        <thead><tr>
          <th data-key="session_id">Session</th>
          <th data-key="project">Project</th>
          <th data-key="source">Source</th>
          <th data-key="requests">Requests</th>
          <th data-key="input_tokens">Input</th>
          <th data-key="output_tokens">Output</th>
          <th data-key="cache_creation_input_tokens">Cache Wr</th>
          <th data-key="cache_read_input_tokens">Cache Rd</th>
          <th data-key="thinking_tokens">Thinking</th>
          <th data-key="cost_usd">Cost</th>
          <th data-key="last_seen">Last seen</th>
        </tr></thead>
        <tbody id="session-body"></tbody>
      </table>
    </div>
  </div>

  <div class="panel">
    <h2>Requests <span class="muted" id="request-count"></span></h2>
    <div class="scroll-table">
      <table id="record-table">
        <thead><tr>
          <th data-key="timestamp">Time</th>
          <th data-key="model">Model</th>
          <th data-key="source">Source</th>
          <th data-key="session_id">Session</th>
          <th data-key="input_tokens">Input</th>
          <th data-key="output_tokens">Output</th>
          <th data-key="cache_creation_input_tokens">Cache Wr</th>
          <th data-key="cache_read_input_tokens">Cache Rd</th>
          <th data-key="thinking_tokens">Thinking</th>
          <th data-key="effort">Effort</th>
          <th data-key="cost_usd">Cost</th>
        </tr></thead>
        <tbody id="record-body"></tbody>
      </table>
    </div>
    <div class="muted" id="truncated-note" style="margin-top:8px;"></div>
  </div>

<script>
const DATA = __DATA_JSON__;
const fmtInt = n => (n || 0).toLocaleString();
const fmtUsd = n => n === null || n === undefined ? "n/a" : "$" + n.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4});
const esc = s => (s ?? "").toString().replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

let sortState = { session: { key: "last_seen", dir: -1 }, record: { key: "timestamp", dir: -1 } };
let expandedKey = null;

function populateFilters() {
  const sources = [...new Set(DATA.records.map(r => r.source))].sort();
  const models = [...new Set(DATA.records.map(r => r.model))].sort();
  const sSel = document.getElementById("f-source");
  const mSel = document.getElementById("f-model");
  for (const s of sources) sSel.insertAdjacentHTML("beforeend", `<option value="${esc(s)}">${esc(s)}</option>`);
  for (const m of models) mSel.insertAdjacentHTML("beforeend", `<option value="${esc(m)}">${esc(m)}</option>`);
  const days = DATA.records.map(r => (r.timestamp || "").slice(0, 10)).filter(Boolean).sort();
  if (days.length) {
    document.getElementById("f-from").value = days[0];
    document.getElementById("f-to").value = days[days.length - 1];
  }
}

function currentFilters() {
  return {
    source: document.getElementById("f-source").value,
    model: document.getElementById("f-model").value,
    search: document.getElementById("f-search").value.trim().toLowerCase(),
    from: document.getElementById("f-from").value,
    to: document.getElementById("f-to").value,
  };
}

function filteredRecords() {
  const f = currentFilters();
  return DATA.records.filter(r => {
    if (f.source && r.source !== f.source) return false;
    if (f.model && r.model !== f.model) return false;
    if (f.search) {
      const hay = `${r.session_id} ${r.project || ""}`.toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    const day = (r.timestamp || "").slice(0, 10);
    if (f.from && day && day < f.from) return false;
    if (f.to && day && day > f.to) return false;
    return true;
  });
}

function aggregate(records) {
  const agg = {
    requests: records.length,
    input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0, thinking_tokens: 0, cost_usd: 0, cost_known: true,
    sessions: new Set(), models: new Set(),
  };
  for (const r of records) {
    agg.input_tokens += r.input_tokens;
    agg.output_tokens += r.output_tokens;
    agg.cache_creation_input_tokens += r.cache_creation_input_tokens;
    agg.cache_read_input_tokens += r.cache_read_input_tokens;
    agg.thinking_tokens += r.thinking_tokens;
    agg.sessions.add(r.session_id);
    agg.models.add(r.model);
    if (r.cost_usd === null || r.cost_usd === undefined) agg.cost_known = false;
    else agg.cost_usd += r.cost_usd;
  }
  agg.total_tokens = agg.input_tokens + agg.output_tokens + agg.cache_creation_input_tokens + agg.cache_read_input_tokens;
  return agg;
}

function renderCards(agg) {
  const cards = [
    ["Requests", fmtInt(agg.requests)],
    ["Sessions", fmtInt(agg.sessions.size)],
    ["Models used", fmtInt(agg.models.size)],
    ["Input tokens", fmtInt(agg.input_tokens)],
    ["Output tokens", fmtInt(agg.output_tokens)],
    ["Cache write", fmtInt(agg.cache_creation_input_tokens)],
    ["Cache read", fmtInt(agg.cache_read_input_tokens)],
    ["Thinking tokens", fmtInt(agg.thinking_tokens)],
    ["Total tokens", fmtInt(agg.total_tokens)],
    ["Est. cost", agg.cost_known ? fmtUsd(agg.cost_usd) : fmtUsd(null) + " *"],
  ];
  document.getElementById("cards").innerHTML = cards.map(([label, value]) =>
    `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`
  ).join("");
}

function byModel(records) {
  const buckets = new Map();
  for (const r of records) {
    if (!buckets.has(r.model)) buckets.set(r.model, aggregate([]));
    const b = buckets.get(r.model);
    b.requests += 1;
    b.input_tokens += r.input_tokens;
    b.output_tokens += r.output_tokens;
    b.cache_creation_input_tokens += r.cache_creation_input_tokens;
    b.cache_read_input_tokens += r.cache_read_input_tokens;
    b.thinking_tokens += r.thinking_tokens;
    if (r.cost_usd === null || r.cost_usd === undefined) b.cost_known = false;
    else b.cost_usd += r.cost_usd;
  }
  return [...buckets.entries()].sort((a, b) =>
    (b[1].input_tokens + b[1].output_tokens) - (a[1].input_tokens + a[1].output_tokens)
  );
}

function renderModelChart(records) {
  const svg = document.getElementById("model-chart");
  const rows = byModel(records);
  const w = Math.max(svg.parentElement.clientWidth - 20, 400);
  const barH = 26, gap = 14, leftPad = 160, rightPad = 60, topPad = 10;
  const h = rows.length * (barH + gap) + topPad;
  const maxVal = Math.max(1, ...rows.map(([, b]) => b.input_tokens + b.output_tokens + b.cache_creation_input_tokens + b.cache_read_input_tokens));
  const scale = (w - leftPad - rightPad) / maxVal;
  const colors = ["var(--input-color)", "var(--output-color)", "var(--cache-w-color)", "var(--cache-r-color)"];
  let svgParts = [];
  rows.forEach(([model, b], i) => {
    const y = topPad + i * (barH + gap);
    const segs = [b.input_tokens, b.output_tokens, b.cache_creation_input_tokens, b.cache_read_input_tokens];
    let x = leftPad;
    svgParts.push(`<text x="${leftPad - 8}" y="${y + barH / 2 + 4}" text-anchor="end" class="bar-label">${esc(model)}</text>`);
    segs.forEach((v, si) => {
      const segW = v * scale;
      if (segW > 0) svgParts.push(`<rect x="${x}" y="${y}" width="${segW}" height="${barH}" fill="${colors[si]}" rx="2"></rect>`);
      x += segW;
    });
    const total = segs.reduce((a, c) => a + c, 0);
    svgParts.push(`<text x="${x + 6}" y="${y + barH / 2 + 4}" class="bar-label">${fmtInt(total)}</text>`);
  });
  svg.setAttribute("viewBox", `0 0 ${w} ${Math.max(h, 40)}`);
  svg.innerHTML = rows.length ? svgParts.join("") : `<text x="10" y="20" class="bar-label">No data for current filters.</text>`;
}

function renderDayChart(records) {
  const svg = document.getElementById("day-chart");
  const buckets = new Map(); // day -> {input, output}
  for (const r of records) {
    const day = (r.timestamp || "").slice(0, 10) || "unknown";
    if (!buckets.has(day)) buckets.set(day, { input: 0, output: 0 });
    const b = buckets.get(day);
    b.input += r.input_tokens;
    b.output += r.output_tokens;
  }
  const days = [...buckets.keys()].sort();
  const w = Math.max(svg.parentElement.clientWidth - 20, 400);
  const h = 200, leftPad = 60, rightPad = 20, topPad = 10, bottomPad = 30;
  const maxVal = Math.max(1, ...days.map(d => Math.max(buckets.get(d).input, buckets.get(d).output)));
  const plotW = w - leftPad - rightPad, plotH = h - topPad - bottomPad;
  const xStep = days.length > 1 ? plotW / (days.length - 1) : 0;

  const seriesPoints = key => days.map((d, i) => [
    leftPad + i * xStep,
    topPad + plotH - (buckets.get(d)[key] / maxVal) * plotH,
  ]);
  const drawLine = (points, color) => {
    if (!points.length) return "";
    const linePath = "M" + points.map(p => p.join(",")).join(" L");
    let s = `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="2"></path>`;
    for (const [x, y] of points) s += `<circle cx="${x}" cy="${y}" r="2.5" fill="${color}"></circle>`;
    return s;
  };

  let parts = [];
  parts.push(`<line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${topPad + plotH}" stroke="var(--border)"></line>`);
  parts.push(`<line x1="${leftPad}" y1="${topPad + plotH}" x2="${leftPad + plotW}" y2="${topPad + plotH}" stroke="var(--border)"></line>`);
  parts.push(drawLine(seriesPoints("input"), "var(--input-color)"));
  parts.push(drawLine(seriesPoints("output"), "var(--output-color)"));
  days.forEach((d, i) => {
    if (i === 0 || i === days.length - 1 || days.length < 10) {
      const x = leftPad + i * xStep;
      parts.push(`<text x="${x}" y="${topPad + plotH + 16}" text-anchor="middle" class="axis-label">${d.slice(5)}</text>`);
    }
  });
  parts.push(`<text x="${leftPad - 8}" y="${topPad + 4}" text-anchor="end" class="axis-label">${fmtInt(maxVal)}</text>`);
  parts.push(`<text x="${leftPad - 8}" y="${topPad + plotH}" text-anchor="end" class="axis-label">0</text>`);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.innerHTML = days.length ? parts.join("") : `<text x="10" y="20" class="bar-label">No data for current filters.</text>`;
}

function bySession(records) {
  const buckets = new Map();
  for (const r of records) {
    if (!buckets.has(r.session_id)) {
      buckets.set(r.session_id, {
        session_id: r.session_id, project: r.project, source: new Set(),
        requests: 0, input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0, thinking_tokens: 0, cost_usd: 0, cost_known: true,
        first_seen: r.timestamp, last_seen: r.timestamp,
      });
    }
    const b = buckets.get(r.session_id);
    b.source.add(r.source);
    b.requests += 1;
    b.input_tokens += r.input_tokens;
    b.output_tokens += r.output_tokens;
    b.cache_creation_input_tokens += r.cache_creation_input_tokens;
    b.cache_read_input_tokens += r.cache_read_input_tokens;
    b.thinking_tokens += r.thinking_tokens;
    if (r.cost_usd === null || r.cost_usd === undefined) b.cost_known = false;
    else b.cost_usd += r.cost_usd;
    if (r.timestamp < b.first_seen) b.first_seen = r.timestamp;
    if (r.timestamp > b.last_seen) b.last_seen = r.timestamp;
    if (r.project && !b.project) b.project = r.project;
  }
  return [...buckets.values()].map(b => ({ ...b, source: [...b.source].join("+"), cost_usd: b.cost_known ? b.cost_usd : null }));
}

function sortRows(rows, sortKey, dir) {
  return rows.slice().sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (av === null || av === undefined) av = -Infinity;
    if (bv === null || bv === undefined) bv = -Infinity;
    if (typeof av === "string") return dir * av.localeCompare(bv);
    return dir * (av - bv);
  });
}

function renderSessionTable(records) {
  let rows = bySession(records);
  rows = sortRows(rows, sortState.session.key, sortState.session.dir);
  document.getElementById("session-body").innerHTML = rows.map(r => `
    <tr>
      <td class="mono">${esc(r.session_id)}</td>
      <td>${esc(r.project || "")}</td>
      <td>${esc(r.source)}</td>
      <td>${fmtInt(r.requests)}</td>
      <td>${fmtInt(r.input_tokens)}</td>
      <td>${fmtInt(r.output_tokens)}</td>
      <td>${fmtInt(r.cache_creation_input_tokens)}</td>
      <td>${fmtInt(r.cache_read_input_tokens)}</td>
      <td>${fmtInt(r.thinking_tokens)}</td>
      <td>${fmtUsd(r.cost_usd)}</td>
      <td>${esc(r.last_seen)}</td>
    </tr>`).join("") || `<tr><td colspan="11" class="muted">No sessions for current filters.</td></tr>`;
}

function renderRecordTable(records) {
  const rows = sortRows(records, sortState.record.key, sortState.record.dir);
  document.getElementById("request-count").textContent = `(${rows.length.toLocaleString()} shown)`;
  document.getElementById("record-body").innerHTML = rows.map((r, i) => {
    const key = r.request_id + "|" + i;
    const rowHtml = `
    <tr data-key="${esc(key)}" class="record-row">
      <td class="mono">${esc(r.timestamp)}</td>
      <td>${esc(r.model)}</td>
      <td>${esc(r.source)}</td>
      <td class="mono">${esc(r.session_id)}</td>
      <td>${fmtInt(r.input_tokens)}</td>
      <td>${fmtInt(r.output_tokens)}</td>
      <td>${fmtInt(r.cache_creation_input_tokens)}</td>
      <td>${fmtInt(r.cache_read_input_tokens)}</td>
      <td>${fmtInt(r.thinking_tokens)}</td>
      <td>${esc(r.effort || "")}</td>
      <td>${fmtUsd(r.cost_usd)}</td>
    </tr>`;
    if (expandedKey === key) {
      return rowHtml + `<tr class="detail-row"><td colspan="11">${esc(JSON.stringify(r.raw_usage, null, 2))}</td></tr>`;
    }
    return rowHtml;
  }).join("") || `<tr><td colspan="11" class="muted">No requests for current filters.</td></tr>`;

  document.querySelectorAll(".record-row").forEach(row => {
    row.addEventListener("click", () => {
      const key = row.getAttribute("data-key");
      expandedKey = expandedKey === key ? null : key;
      renderRecordTable(filteredRecords());
    });
  });
}

function renderMeta() {
  const note = DATA.truncated > 0
    ? `Showing the ${DATA.records.length.toLocaleString()} most recent of a larger dataset (${DATA.truncated.toLocaleString()} older requests not embedded -- query the SQLite store directly for full history).`
    : "";
  document.getElementById("truncated-note").textContent = note;
  document.getElementById("meta").textContent = `Generated ${DATA.generated_at} · ${DATA.records.length.toLocaleString()} requests embedded. * cost shown as n/a for any model missing from the local pricing table.`;
}

function renderAll() {
  const records = filteredRecords();
  renderCards(aggregate(records));
  renderModelChart(records);
  renderDayChart(records);
  renderSessionTable(records);
  renderRecordTable(records);
}

function wireSorting() {
  document.querySelectorAll("#session-table th[data-key]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-key");
      const s = sortState.session;
      s.dir = s.key === key ? -s.dir : -1;
      s.key = key;
      renderSessionTable(filteredRecords());
    });
  });
  document.querySelectorAll("#record-table th[data-key]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-key");
      const s = sortState.record;
      s.dir = s.key === key ? -s.dir : -1;
      s.key = key;
      renderRecordTable(filteredRecords());
    });
  });
}

populateFilters();
renderMeta();
wireSorting();
renderAll();
["f-source", "f-model", "f-search", "f-from", "f-to"].forEach(id =>
  document.getElementById(id).addEventListener("input", renderAll)
);
window.addEventListener("resize", renderAll);
</script>
</body>
</html>
"""
