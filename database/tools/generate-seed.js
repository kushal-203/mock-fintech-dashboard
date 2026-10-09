#!/usr/bin/env node
/*
 * Generates database/seeds/001_seed_data.sql deterministically (fixed PRNG seed), so every
 * run of the app and the tests starts from identical data.
 *
 *   node database/tools/generate-seed.js
 *
 * The data contains hand-designed round-trip test cases (match / no-match boundaries) plus
 * random "noise" transfers. Noise that would accidentally create an extra round trip is
 * dropped, so the expected round-trip result is exactly the designed set. That set is written
 * to database/seeds/expected_round_trips.json and used by `npm run db:query` as an oracle.
 */
const fs = require('fs');
const path = require('path');

// ---------- deterministic PRNG ----------
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260901);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

const ACCOUNTS = [
  ['ACC-1001', 'Aarav Mehta', 'personal', 'active', 2500000_00],
  ['ACC-1002', 'Bilal Khan', 'personal', 'active', 1800000_00],
  ['ACC-1003', 'Chen Wei Trading Ltd', 'business', 'active', 9000000_00],
  ['ACC-1004', 'Divya Nair', 'personal', 'active', 1200000_00],
  ['ACC-1005', 'Erik Johansson', 'personal', 'active', 950000_00],
  ['ACC-1006', 'Farah Siddiqui Imports', 'business', 'active', 7500000_00],
  ['ACC-1007', 'Gabriel Costa', 'personal', 'active', 600000_00],
  ['ACC-1008', 'Hana Sato Consulting', 'business', 'active', 4200000_00],
  ['ACC-1009', 'Isabel Romero', 'personal', 'active', 300000_00],
  ['ACC-1010', 'Jonas Weber (frozen)', 'personal', 'frozen', 150000_00],
];
const ACTIVE = ACCOUNTS.filter((a) => a[3] === 'active').map((a) => a[0]);

const DESCRIPTIONS = ['Invoice payment', 'Rent', 'Supplier settlement', 'Payroll', 'Refund', 'Consulting fee',
  'Loan repayment', 'Utilities', 'Subscription', 'Equipment purchase', 'Marketing services', 'Travel reimbursement'];

const ts = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const at = (s) => new Date(`${s.replace(' ', 'T')}Z`);

// ---------- designed round-trip cases (expected result in `expect`) ----------
const designed = [
  { case: 'TC1 exact amount back after 2h', expect: true,
    out: ['ACC-1001', 'ACC-1002', 10000_00, '2026-09-03 09:00:00'], back: ['ACC-1002', 'ACC-1001', 10000_00, '2026-09-03 11:00:00'] },
  { case: 'TC2 9% lower back after 20h', expect: true,
    out: ['ACC-1003', 'ACC-1004', 50000_00, '2026-09-05 08:00:00'], back: ['ACC-1004', 'ACC-1003', 45500_00, '2026-09-06 04:00:00'] },
  { case: 'TC3 boundary: exactly +10% and exactly 24h', expect: true,
    out: ['ACC-1005', 'ACC-1006', 20000_00, '2026-09-08 10:00:00'], back: ['ACC-1006', 'ACC-1005', 22000_00, '2026-09-09 10:00:00'] },
  { case: 'TC4 crosses midnight, +5% after 3h', expect: true,
    out: ['ACC-1004', 'ACC-1005', 12000_00, '2026-09-14 22:30:00'], back: ['ACC-1005', 'ACC-1004', 12600_00, '2026-09-15 01:30:00'] },
  { case: 'TC5 15% lower', expect: false,
    out: ['ACC-1001', 'ACC-1003', 8000_00, '2026-09-16 12:00:00'], back: ['ACC-1003', 'ACC-1001', 6800_00, '2026-09-16 13:00:00'] },
  { case: 'TC6 24h + 1 minute later', expect: false,
    out: ['ACC-1002', 'ACC-1004', 3000_00, '2026-09-18 09:00:00'], back: ['ACC-1004', 'ACC-1002', 3000_00, '2026-09-19 09:01:00'] },
  { case: 'TC7 return transfer FAILED', expect: false, backStatus: 'failed',
    out: ['ACC-1007', 'ACC-1008', 15000_00, '2026-09-20 14:00:00'], back: ['ACC-1008', 'ACC-1007', 15000_00, '2026-09-20 16:00:00'] },
  { case: 'TC8 money moves on to a third account', expect: false,
    out: ['ACC-1006', 'ACC-1002', 7000_00, '2026-09-22 08:00:00'], back: ['ACC-1002', 'ACC-1009', 7000_00, '2026-09-22 09:00:00'] },
  { case: 'TC9 one outbound, two returns in window -> 2 pairs', expect: true, extraBack: ['ACC-1008', 'ACC-1001', 41000_00, '2026-09-25 08:00:00'],
    out: ['ACC-1001', 'ACC-1008', 40000_00, '2026-09-24 09:00:00'], back: ['ACC-1008', 'ACC-1001', 39000_00, '2026-09-24 15:00:00'] },
  { case: 'TC10 pending return still counts, -2% after 1h', expect: true, backStatus: 'pending',
    out: ['ACC-1009', 'ACC-1003', 2500_00, '2026-09-27 10:00:00'], back: ['ACC-1003', 'ACC-1009', 2450_00, '2026-09-27 11:00:00'] },
];

let rows = [];
designed.forEach((d, i) => {
  const mk = (t, role, status = 'completed') => ({
    from: t[0], to: t[1], cents: t[2], created: t[3], status,
    description: role === 'out' ? 'Supplier settlement' : 'Refund', designed: `${i}:${role}`,
  });
  rows.push(mk(d.out, 'out'));
  rows.push(mk(d.back, 'back', d.backStatus));
  if (d.extraBack) rows.push(mk(d.extraBack, 'back2'));
});

// ---------- noise ----------
const start = at('2026-09-01 00:00:00').getTime();
for (let i = 0; i < 110; i += 1) {
  const from = pick(ACTIVE);
  let to = pick(ACTIVE);
  while (to === from) to = pick(ACTIVE);
  const r = rand();
  const status = r < 0.82 ? 'completed' : r < 0.93 ? 'pending' : 'failed';
  const minutes = between(0, 29 * 24 * 60 + 23 * 60);
  const cents = (rand() < 0.7 ? between(50, 5000) : between(5000, 60000)) * 100 + between(0, 99);
  rows.push({ from, to, cents, created: ts(new Date(start + minutes * 60000)), status, description: pick(DESCRIPTIONS) });
}

// ---------- remove noise that creates unexpected round trips ----------
function roundTrips(list) {
  const pairs = [];
  for (const o of list) for (const r of list) {
    if (o === r || o.status === 'failed' || r.status === 'failed') continue;
    if (r.from !== o.to || r.to !== o.from) continue;
    const gapH = (at(r.created) - at(o.created)) / 3600000;
    if (gapH <= 0 || gapH > 24) continue;
    if (Math.abs(r.cents - o.cents) * 100 > 10 * o.cents) continue;
    pairs.push([o, r]);
  }
  return pairs;
}
for (;;) {
  const bad = roundTrips(rows).find(([o, r]) => !(o.designed && r.designed));
  if (!bad) break;
  const victim = bad[0].designed ? bad[1] : bad[0];
  rows = rows.filter((x) => x !== victim);
}

// ---------- assign ids in time order ----------
rows.sort((a, b) => a.created.localeCompare(b.created) || a.from.localeCompare(b.from));
rows.forEach((r, i) => { r.id = `TXN-${String(i + 1).padStart(6, '0')}`; });

const expected = roundTrips(rows).map(([o, r]) => ({ outbound_txn: o.id, return_txn: r.id }));
const designedMatches = designed.filter((d) => d.expect).length + 1; // TC9 yields two pairs
if (expected.length !== designedMatches) throw new Error(`Expected ${designedMatches} round trips, got ${expected.length}`);

// ---------- write SQL ----------
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sql = [
  '-- 001_seed_data.sql  (GENERATED by database/tools/generate-seed.js – do not edit by hand)',
  '-- 10 accounts (1 frozen) and September 2026 transfers, including designed round-trip cases:',
  ...designed.map((d) => `--   ${d.expect ? 'MATCH   ' : 'NO MATCH'} ${d.case}`),
  '',
  'INSERT INTO accounts (account_id, holder_name, account_type, status, balance_cents, created_at) VALUES',
  `${ACCOUNTS.map((a) => `  (${q(a[0])}, ${q(a[1])}, ${q(a[2])}, ${q(a[3])}, ${a[4]}, '2026-01-15 09:00:00')`).join(',\n')};`,
  '',
  'INSERT INTO transactions (txn_id, from_account, to_account, amount_cents, currency, description, status, created_at) VALUES',
  `${rows.map((r) => `  (${q(r.id)}, ${q(r.from)}, ${q(r.to)}, ${r.cents}, 'USD', ${q(r.description)}, ${q(r.status)}, ${q(r.created)})`).join(',\n')};`,
  '',
].join('\n');

const seedsDir = path.join(__dirname, '..', 'seeds');
fs.writeFileSync(path.join(seedsDir, '001_seed_data.sql'), sql);
fs.writeFileSync(path.join(seedsDir, 'expected_round_trips.json'), `${JSON.stringify(expected, null, 2)}\n`);
console.log(`Wrote ${rows.length} transactions, ${expected.length} expected round-trip pairs.`);
