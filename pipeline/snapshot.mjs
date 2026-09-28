// Build data/radar.json, the only file the site reads: every fetched posting, with Jev's labels
// merged in where a labeled run exists. Unlabeled postings keep null labels so the site shows "—"
// instead of guessing.
//
//   node pipeline/snapshot.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'data');

const postings = fs.readFileSync(path.join(DATA, 'input.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const resultsPath = path.join(DATA, 'results.json');
const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath, 'utf8')) : null;
const labels = new Map((results?.rows ?? []).map((r) => [r.url, r]));

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const rows = postings.map((p) => {
  const l = labels.get(p.url);
  return {
    company: p.company,
    title: p.title,
    location: p.location || null,
    url: p.url,
    payLow: num(p.pay_low),
    payHigh: num(p.pay_high),
    remote: String(p.remote_listed).toLowerCase() === 'true',
    bucket: l?.bucket ?? null,
    roleKind: l?.role_kind ?? null,
    aiScope: l?.ai_scope ?? null,
    seniority: l?.seniority ?? null,
    mlRequired: l?.requires_ml_background ?? null,
  };
});

const out = {
  fetchedAt: fs.statSync(path.join(DATA, 'input.jsonl')).mtime.toISOString(),
  labeledAt: results?.generatedAt ?? null,
  model: results?.model ?? null,
  headline: results?.headline ?? null,
  boards: new Set(postings.map((p) => p.company)).size,
  rows,
};
fs.writeFileSync(path.join(DATA, 'radar.json'), JSON.stringify(out));
console.log(`data/radar.json: ${rows.length} postings, ${rows.filter((r) => r.bucket).length} labeled`);
