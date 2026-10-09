const { getDb, readQuery } = require('../db/connection');
const { toIso, toAmount } = require('./mappers');

const ROUND_TRIP_SQL = readQuery('round_trips.sql'); // single source of truth, shared with /database

function roundTrips({ windowHours = 24, tolerancePct = 10 } = {}) {
  const rows = getDb().prepare(ROUND_TRIP_SQL).all({ window_hours: windowHours, tolerance_pct: tolerancePct });
  const data = rows.map((r) => ({
    outboundTxn: r.outbound_txn,
    returnTxn: r.return_txn,
    accountA: r.account_a,
    accountB: r.account_b,
    amountSent: toAmount(r.amount_sent_cents),
    amountReturned: toAmount(r.amount_returned_cents),
    pctDifference: r.pct_difference,
    sentAt: toIso(r.sent_at),
    returnedAt: toIso(r.returned_at),
    hoursApart: r.hours_apart,
  }));
  const accountsInvolved = [...new Set(data.flatMap((d) => [d.accountA, d.accountB]))].sort();
  return { criteria: { windowHours, tolerancePct }, count: data.length, accountsInvolved, data };
}

function dailyVolume() {
  return getDb().prepare(`
    SELECT substr(created_at, 1, 10) AS date, SUM(amount_cents) AS cents, COUNT(*) AS count
    FROM transactions WHERE status = 'completed'
    GROUP BY date ORDER BY date`).all().map((r) => ({ date: r.date, volume: toAmount(r.cents), count: r.count }));
}

function summary() {
  const db = getDb();
  const t = db.prepare(`
    SELECT COUNT(*) AS txns,
           COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_cents END), 0) AS completedCents,
           SUM(status = 'completed') AS completed, SUM(status = 'pending') AS pending, SUM(status = 'failed') AS failed
    FROM transactions`).get();
  const { active } = db.prepare("SELECT COUNT(*) AS active FROM accounts WHERE status = 'active'").get();
  const rt = roundTrips();
  return {
    totalVolume: toAmount(t.completedCents),
    transactionCount: t.txns,
    byStatus: { completed: t.completed || 0, pending: t.pending || 0, failed: t.failed || 0 },
    activeAccounts: active,
    flaggedRoundTrips: rt.count,
    flaggedAccounts: rt.accountsInvolved,
  };
}

module.exports = { roundTrips, dailyVolume, summary };
