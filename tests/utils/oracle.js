// Independent "oracle" calculations. Deliberately written without importing any backend code, so a
// bug in the app's SQL or maths cannot hide in the expected value as well.

const cents = (amount) => Math.round(amount * 100);
const hoursBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 3_600_000;

/** A -> B then B -> A, return strictly later and <= windowHours, amount within tolerancePct of the original. */
function findRoundTrips(transactions, { windowHours = 24, tolerancePct = 10 } = {}) {
  const usable = transactions.filter((t) => t.status !== 'failed');
  const pairs = [];
  for (const o of usable) {
    for (const r of usable) {
      if (r.fromAccount !== o.toAccount || r.toAccount !== o.fromAccount) continue;
      const gap = hoursBetween(o.createdAt, r.createdAt);
      if (gap <= 0 || gap > windowHours) continue;
      if (Math.abs(cents(r.amount) - cents(o.amount)) * 100 > tolerancePct * cents(o.amount)) continue;
      pairs.push({ outboundTxn: o.id, returnTxn: r.id });
    }
  }
  return pairs.sort((a, b) => a.outboundTxn.localeCompare(b.outboundTxn) || a.returnTxn.localeCompare(b.returnTxn));
}

function summarise(transactions) {
  const completed = transactions.filter((t) => t.status === 'completed');
  return {
    totalVolume: completed.reduce((s, t) => s + cents(t.amount), 0) / 100,
    transactionCount: transactions.length,
  };
}

function dailyVolume(transactions) {
  const byDay = new Map();
  for (const t of transactions.filter((x) => x.status === 'completed')) {
    const day = t.createdAt.slice(0, 10);
    const cur = byDay.get(day) || { cents: 0, count: 0 };
    cur.cents += cents(t.amount);
    cur.count += 1;
    byDay.set(day, cur);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, volume: v.cents / 100, count: v.count }));
}

module.exports = { findRoundTrips, summarise, dailyVolume, cents };
