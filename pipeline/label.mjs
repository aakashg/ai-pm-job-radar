// Label every job posting in data/input.jsonl with Jev through Vercel AI Gateway.
//
//   node pipeline/label.mjs [--sample 40] [--concurrency 16] [--dry-run]
//
// Needs AI_GATEWAY_API_KEY locally (on Vercel, the deployment's OIDC token is used instead).
// Writes data/results.json for the site and data/summary.md for humans. Answers are cached in
// data/cache.jsonl by question-set hash + item, so a rerun only pays for new or changed postings.
import { experimental_evaluate as evaluate } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'data');
const PRICE_PER_TOKEN = 0.042 / 1e6; // input only, output is free
const MODEL = 'typesafe-ai/jev';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1] === undefined || args[i + 1].startsWith('--') ? true : args[i + 1];
};
const sample = Number(flag('sample', 0));
const concurrency = Number(flag('concurrency', 16));
const dryRun = flag('dry-run', false) === true;

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline/spec.json'), 'utf8'));
let items = fs.readFileSync(path.join(DATA, 'input.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
if (sample && sample < items.length) items = seededSample(items, sample, 7);

// Native Jev calls yes/no questions "noul"; the AI SDK calls them "boolean".
const questions = Object.fromEntries(Object.entries(spec.questions).map(([k, q]) =>
  [k, q.type === 'noul' ? { ...q, type: 'boolean' } : q]));
const qhash = sha1(JSON.stringify([MODEL, questions])).slice(0, 10);

const stateFor = (it) => ({ ...spec.context, ...Object.fromEntries(spec.state_fields.map((f) => [f, it[f]])) });
const keyFor = (state) => sha1(qhash + JSON.stringify(state));

if (dryRun) {
  const chars = items.reduce((n, it) => n + JSON.stringify({ state: stateFor(it), questions }).length, 0);
  const tokens = Math.round(chars / 4);
  console.log(`${items.length} items, ~${tokens.toLocaleString()} input tokens, ~$${(tokens * PRICE_PER_TOKEN).toFixed(4)}`);
  process.exit(0);
}

const cachePath = path.join(DATA, 'cache.jsonl');
const cache = new Map(fs.existsSync(cachePath)
  ? fs.readFileSync(cachePath, 'utf8').split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return [r.key, r]; })
  : []);
const cacheOut = fs.createWriteStream(cachePath, { flags: 'a' });

const t0 = Date.now();
let tokens = 0, calls = 0, failed = 0, modelId = null, metaLogged = false;
const rows = new Array(items.length);

await pool(items.map((it, i) => async () => {
  const state = stateFor(it);
  const key = keyFor(state);
  let hit = cache.get(key);
  if (!hit) {
    try {
      const r = await evaluate({ model: gateway.evaluationModel(MODEL), state, questions });
      if (!metaLogged) { console.log('providerMetadata sample:', JSON.stringify(r.providerMetadata)); metaLogged = true; }
      hit = { key, answers: r.answers, confidence: confidenceFrom(r.providerMetadata), tokens: r.usage.inputTokens ?? 0, model: r.response.modelId };
      cache.set(key, hit);
      cacheOut.write(JSON.stringify(hit) + '\n');
      tokens += hit.tokens; calls += 1; modelId = hit.model;
    } catch (e) {
      failed += 1;
      console.error(`failed: ${it.company} / ${it.title}: ${e.message?.slice(0, 200)}`);
      return;
    }
  }
  const flat = flatten(hit.answers, hit.confidence);
  rows[i] = { ...pick(it, ['company', 'title', 'location', 'department', 'url', 'pay_low', 'pay_high', 'remote_listed']), ...flat, bucket: bucketFor(flat, spec.buckets) };
}), concurrency);
cacheOut.end();

const done = rows.filter(Boolean);
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const counts = countBy(done, 'bucket');
const headline = `${done.length} postings in ${secs} s for $${(tokens * PRICE_PER_TOKEN).toFixed(4)} (${calls} new calls, ${done.length - calls} cached${failed ? `, ${failed} failed` : ''}), ${modelId ?? 'all cached'}`;

const outName = sample ? `sample-${sample}` : 'results';
fs.writeFileSync(path.join(DATA, `${outName}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), model: modelId, headline, counts, rows: done }, null, 1));
fs.writeFileSync(path.join(DATA, `${outName}.md`), summaryMd(headline, counts, done));
console.log(`\n${headline}\n`);
for (const [b, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${b.padEnd(24)} ${n}`);
console.log(`\nWrote data/${outName}.json and data/${outName}.md`);

// ---------- helpers ----------

function confidenceFrom(meta) {
  // Jev's own confidence rides in provider metadata through the Gateway. Keep whatever per-question
  // numbers are there; if the shape is different, buckets that need confidence send the item to review.
  const t = meta?.typesafe ?? meta?.['typesafe-ai'] ?? {};
  const c = t.confidence ?? t.answers ?? {};
  if (typeof c !== 'object') return {};
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, typeof v === 'number' ? v : v?.confidence]).filter(([, v]) => typeof v === 'number'));
}

function flatten(answers, confidence) {
  const out = {};
  for (const [q, a] of Object.entries(answers)) {
    if (a.type === 'choice') {
      out[q] = a.choice;
      out[`${q}.p`] = round(a.probabilities?.[a.choice]);
    } else if (a.type === 'score') {
      out[q] = spec.questions[q].criteria[Math.round(a.score)];
      out[`${q}.score`] = round(a.score);
    } else {
      out[q] = round(a.probability);
    }
    if (confidence[q] !== undefined) out[`${q}.confidence`] = round(confidence[q]);
  }
  return out;
}

function bucketFor(row, rules) {
  const OPS = {
    '==': (a, b) => a === b, '!=': (a, b) => a !== b, 'in': (a, b) => b.includes(a), 'not_in': (a, b) => !b.includes(a),
    '>=': (a, b) => a != null && a >= b, '>': (a, b) => a != null && a > b,
    '<=': (a, b) => a != null && a <= b, '<': (a, b) => a != null && a < b,
  };
  for (const rule of rules ?? []) {
    let ok = (rule.when ?? []).every(([p, op, v]) => OPS[op](row[p], v));
    if (rule.any) ok = ok && rule.any.some(([p, op, v]) => OPS[op](row[p], v));
    if (ok) return rule.name;
  }
  return 'review';
}

function summaryMd(headline, counts, rows) {
  const cols = spec.show;
  const lines = [`# Job radar run`, '', headline, '', '## Buckets', '',
    ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([b, n]) => `- ${b}: ${n}`), '', '## Rows', '',
    `| bucket | ${cols.join(' | ')} |`, `|${'---|'.repeat(cols.length + 1)}`,
    ...rows.map((r) => `| ${r.bucket} | ${cols.map((c) => String(r[c] ?? '—').replace(/\|/g, '/')).join(' | ')} |`)];
  return lines.join('\n') + '\n';
}

async function pool(tasks, n) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => {
    while (next < tasks.length) await tasks[next++]();
  }));
}

function seededSample(arr, n, seed) {
  const a = [...arr];
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

function sha1(s) { return crypto.createHash('sha1').update(s).digest('hex'); }
function round(x) { return typeof x === 'number' ? Math.round(x * 1000) / 1000 : x; }
function pick(o, ks) { return Object.fromEntries(ks.map((k) => [k, o[k]])); }
function countBy(rows, k) { return rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {}); }
