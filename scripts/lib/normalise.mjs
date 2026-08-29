// Pure, unit-tested transform from a raw Notion "Cardio V3" row to a Question
// object. No I/O here — sync-notion.mjs (and the MCP-backed bootstrap) both
// funnel rows through this module so the shape is identical regardless of
// how the row was fetched.

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/**
 * Position 0 = specialty, position 1 = the pearl's topic (mirrors the page
 * Name), position 2 = the *question's* topic. This is intentional — do not
 * "fix" a topic that looks mismatched against the page title. Falls back to
 * the last element when fewer than three parts are present.
 */
export function parseTopicString(topicRaw) {
  const parts = String(topicRaw ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length === 0) {
    return { parts, specialty: '', pearlTopic: '', fineTopic: '' };
  }

  const specialty = parts[0];
  const pearlTopic = parts.length >= 2 ? parts[1] : parts[parts.length - 1];
  const fineTopic = parts.length >= 3 ? parts[2] : parts[parts.length - 1];

  return { parts, specialty, pearlTopic, fineTopic };
}

/** Notion page URLs look like https://app.notion.com/p/<32 hex chars>[?...] */
export function toPageId(url) {
  const match = String(url ?? '').match(/([0-9a-f]{32})(?:[?#]|$)/i);
  if (!match) {
    throw new Error(`toPageId: could not extract a page id from url: ${url}`);
  }
  const hex = match[1].toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Strips the leading "✅ Answer: X. ..." line from the Answer HTML. Appears
 * in two shapes in the source data:
 *   <p><b>✅ Answer: C. Ibuprofen and colchicine</b></p>
 *   <p>✅ <b>Answer: E. Insert an inferior vena caval filter</b></p>
 * Also swallows any <br> immediately following, which the second shape uses
 * as a paragraph separator.
 */
export function stripAnswerPrefix(answerHtml) {
  const html = String(answerHtml ?? '');
  const leadingAnswerLine =
    /^\s*<p>\s*(?:<b>\s*✅\s*Answer:[^<]*<\/b>|✅\s*<b>\s*Answer:[^<]*<\/b>)\s*<\/p>/i;
  let stripped = html.replace(leadingAnswerLine, '');
  stripped = stripped.replace(/^(\s*<br\s*\/?>\s*)+/i, '');
  return stripped.trim();
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

/**
 * Normalises a single raw Notion row into a Question. `topicGroupMap` maps
 * fine topic -> group name; a missing entry yields `group: null` rather than
 * throwing, so callers can collect every unmapped topic across the whole
 * bank before failing loudly (see normaliseAll).
 */
export function normaliseRow(row, topicGroupMap = {}) {
  const id = toPageId(row.url);
  const { specialty, pearlTopic, fineTopic } = parseTopicString(row.Topic);
  const group = Object.prototype.hasOwnProperty.call(topicGroupMap, fineTopic)
    ? topicGroupMap[fineTopic]
    : null;

  const options = LETTERS.map((letter, i) => ({
    key: letter,
    text: String(row[`Option ${i + 1}`] ?? '').trim()
  }));

  const correctAnswer = String(row['Correct Answer'] ?? '').trim();
  const correctOption = options.find((o) => o.key === correctAnswer) ?? null;

  const questionHtmlRaw = row.Question;
  const incomplete = isBlank(questionHtmlRaw);

  return {
    id,
    url: row.url,
    name: row.Name ?? '',
    specialty,
    pearlTopic,
    topic: fineTopic,
    group,
    status: row.Status ?? '',
    questionStem: String(row['Question stem'] ?? '').trim(),
    questionHtml: incomplete ? null : String(questionHtmlRaw).trim(),
    incomplete,
    options,
    correctAnswer,
    correctAnswerText: correctOption ? correctOption.text : '',
    explanationHtml: stripAnswerPrefix(row.Answer),
    pearlHtml: String(row['MRCP Pearl'] ?? '').trim()
  };
}

/**
 * Normalises every row. By default throws if any fine topic in the bank has
 * no entry in topicGroupMap — the build must fail loudly rather than ship an
 * uncategorised question. Pass { strict: false } to get the unmapped list
 * back instead (used by tests and by the dry-run report).
 */
export function normaliseAll(rows, topicGroupMap = {}, { strict = true } = {}) {
  const questions = rows.map((row) => normaliseRow(row, topicGroupMap));
  const unmappedTopics = [...new Set(questions.filter((q) => q.group === null).map((q) => q.topic))].sort();

  if (strict && unmappedTopics.length > 0) {
    throw new Error(
      `normaliseAll: ${unmappedTopics.length} unmapped topic(s) — no group mapping in topic-groups.json for: ${unmappedTopics.join(', ')}`
    );
  }

  return { questions, unmappedTopics };
}
