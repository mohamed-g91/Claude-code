#!/usr/bin/env node
// Re-runnable content sync: Notion "Cardio V3" (and any future source in
// sources.json) -> public/content/*.json.
//
// Two modes:
//   node scripts/sync-notion.mjs             live, needs NOTION_TOKEN
//   node scripts/sync-notion.mjs --dry-run   offline, reads the committed
//                                             fixture, no network call ever
//
// The committed public/content/*.json is what the app actually ships with —
// this script exists so a specialty can be re-synced later, not because the
// running PWA fetches Notion.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normaliseAll } from './lib/normalise.mjs';
import { generatePlayItems, printSummary } from './lib/generate-play-items.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function loadJson(relPath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relPath), 'utf-8'));
}

/** Maps one page from the official @notionhq/client API into our flat row shape. */
function mapNotionPage(page) {
  const props = page.properties;
  const plainText = (rt) => (rt ?? []).map((t) => t.plain_text).join('');
  const richText = (name) => plainText(props[name]?.rich_text);
  const selectName = (name) => props[name]?.select?.name ?? '';
  const title = (name) => plainText(props[name]?.title);

  return {
    url: page.url,
    Name: title('Name'),
    Topic: richText('Topic'),
    Question: richText('Question'),
    'Question stem': richText('Question stem'),
    'Option 1': richText('Option 1'),
    'Option 2': richText('Option 2'),
    'Option 3': richText('Option 3'),
    'Option 4': richText('Option 4'),
    'Option 5': richText('Option 5'),
    'Correct Answer': selectName('Correct Answer'),
    Answer: richText('Answer'),
    'MRCP Pearl': richText('MRCP Pearl'),
    Status: selectName('Status')
  };
}

async function fetchRowsLive(dataSourceUrl) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error(
      'NOTION_TOKEN is not set. Create a Notion internal integration, share the ' +
        'Cardio V3 database with it, and export NOTION_TOKEN=secret_... before running ' +
        'this without --dry-run. Use --dry-run to sync from the committed fixture instead.'
    );
  }
  const { Client } = await import('@notionhq/client');
  const notion = new Client({ auth: token });
  const dataSourceId = dataSourceUrl.replace(/^collection:\/\//, '');

  const rows = [];
  let cursor = undefined;
  do {
    // Newer workspaces expose multi-source databases via dataSources.query;
    // older ones only have databases.query. Try the modern call first.
    const page = notion.dataSources
      ? await notion.dataSources.query({ data_source_id: dataSourceId, start_cursor: cursor, page_size: 100 })
      : await notion.databases.query({ database_id: dataSourceId, start_cursor: cursor, page_size: 100 });
    rows.push(...page.results.map(mapNotionPage));
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);

  return rows;
}

function validate(rows, questions, unmappedTopics, sourceLabel) {
  const problems = [];
  const missingKeys = questions.filter((q) => !['A', 'B', 'C', 'D', 'E'].includes(q.correctAnswer));
  const incomplete = questions.filter((q) => q.incomplete);

  if (unmappedTopics.length > 0) {
    problems.push(`${unmappedTopics.length} unmapped topic(s): ${unmappedTopics.join(', ')}`);
  }
  if (missingKeys.length > 0) {
    problems.push(`${missingKeys.length} question(s) missing a valid A-E correct answer key`);
  }

  console.log(`\n[${sourceLabel}] sync report`);
  console.log(`  rows in:        ${rows.length}`);
  console.log(`  questions out:  ${questions.length}`);
  console.log(`  incomplete:     ${incomplete.length}`);
  console.log(`  missing keys:   ${missingKeys.length}`);
  console.log(`  unmapped topics:${unmappedTopics.length}`);

  return problems;
}

async function syncSource(source) {
  const topicGroups = loadJson('scripts/topic-groups.json');

  const rows = dryRun ? loadJson(source.fixture) : await fetchRowsLive(source.dataSourceUrl);

  const { questions, unmappedTopics } = normaliseAll(rows, topicGroups.map, { strict: false });
  const problems = validate(rows, questions, unmappedTopics, source.label);

  if (problems.length > 0) {
    console.error(`\n[${source.label}] FAILED validation:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return null;
  }

  const { output: playItems, summary } = generatePlayItems(questions, { seed: `${source.specialty}-v1` });
  printSummary(summary);

  const contentDir = path.join(repoRoot, 'public', 'content');
  mkdirSync(contentDir, { recursive: true });

  const contentOutput = {
    version: 1,
    specialty: source.specialty,
    label: source.label,
    sourceDatabase: source.databaseName,
    questionCount: questions.length,
    questions
  };

  writeFileSync(path.join(contentDir, source.outputFile), JSON.stringify(contentOutput, null, 2) + '\n');
  writeFileSync(path.join(contentDir, source.playOutputFile), JSON.stringify(playItems, null, 2) + '\n');

  return {
    specialty: source.specialty,
    label: source.label,
    contentFile: `content/${source.outputFile}`,
    playFile: `content/${source.playOutputFile}`,
    questionCount: questions.length,
    groups: topicGroups.groups
  };
}

async function main() {
  console.log(dryRun ? 'Running sync-notion in --dry-run mode (fixture, no network).' : 'Running sync-notion against live Notion API.');

  const sources = loadJson('scripts/sources.json');
  const manifestEntries = [];

  for (const source of sources) {
    const entry = await syncSource(source);
    if (entry) manifestEntries.push(entry);
  }

  if (process.exitCode === 1) {
    console.error('\nOne or more sources failed validation; manifest not written.');
    process.exit(1);
  }

  const manifest = {
    version: 1,
    generatedBy: dryRun ? 'sync-notion.mjs --dry-run (fixture)' : 'sync-notion.mjs (live)',
    specialties: manifestEntries
  };
  writeFileSync(
    path.join(repoRoot, 'public', 'content', 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
  console.log('\nWrote public/content/manifest.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
