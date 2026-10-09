#!/usr/bin/env node
// Runs database/queries/round_trips.sql against a fresh in-memory copy of the schema + seed data,
// prints the result, checks it against database/seeds/expected_round_trips.json and saves
// results/sql/round-trips.txt (+ a PNG screenshot when Playwright's Chromium is installed).
//   npm run db:query            (defaults: 10 %, 24 h)
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { DatabaseSync } = require('node:sqlite');

const DB_DIR = path.resolve(__dirname, '..');
const OUT = path.resolve(__dirname, '..', '..', 'results', 'sql');
const read = (...p) => fs.readFileSync(path.join(DB_DIR, ...p), 'utf8');
const sqlIn = (dir) => fs.readdirSync(path.join(DB_DIR, dir)).filter((f) => f.endsWith('.sql')).sort();

const db = new DatabaseSync(':memory:');
for (const f of sqlIn('migrations')) db.exec(read('migrations', f));
for (const f of sqlIn('seeds')) db.exec(read('seeds', f));

const query = read('queries', 'round_trips.sql');
const rows = db.prepare(query).all({ tolerance_pct: 10, window_hours: 24 }).map((r) => ({ ...r }));

const expected = JSON.parse(read('seeds', 'expected_round_trips.json'));
assert.deepStrictEqual(rows.map((r) => ({ outbound_txn: r.outbound_txn, return_txn: r.return_txn })), expected,
  'Round-trip query result differs from the expected pairs designed into the seed data');

const cols = Object.keys(rows[0]);
const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
const line = (vals) => vals.map((v, i) => String(v).padEnd(widths[i])).join(' | ');
const table = [line(cols), widths.map((w) => '-'.repeat(w)).join('-+-'), ...rows.map((r) => line(cols.map((c) => r[c])))].join('\n');
const text = `Round-trip transfers (tolerance 10 %, window 24 h) – SQLite ${process.versions.sqlite}\n\n${table}\n\n✔ ${rows.length} pairs – matches database/seeds/expected_round_trips.json\n`;
console.log(text);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'round-trips.txt'), text);

(async () => {
  try {
    const { chromium } = require('playwright');
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{font:14px system-ui,sans-serif;margin:24px;color:#172033} h1{font-size:18px}
      pre{background:#0f1a33;color:#e2e8f0;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap}
      table{border-collapse:collapse;margin-top:12px} th,td{border:1px solid #d0d5dd;padding:6px 10px;text-align:left} th{background:#f1f5f9}
      .ok{color:#0f8a5f;font-weight:700}</style>
      <h1>Round-trip transfers – database/queries/round_trips.sql (10 %, 24 h)</h1><pre>${esc(query)}</pre>
      <p>${rows.length} rows · <span class="ok">matches the expected pairs designed into the seed data</span> · SQLite ${esc(process.versions.sqlite)}</p>
      <table><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</table>`;
    const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
    const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
    await page.setContent(html);
    await page.screenshot({ path: path.join(OUT, 'round-trips.png'), fullPage: true });
    await browser.close();
    console.log(`Saved ${path.join(OUT, 'round-trips.png')}`);
  } catch (e) {
    console.warn(`Screenshot skipped: ${e.message.split('\n')[0]}`);
  }
})();
