-- round_trips.sql
-- Rapid "round-trip" transfers: Account A sends money to Account B, and Account B sends a
-- similar amount (within :tolerance_pct % of the original) back to Account A, with the return
-- happening AFTER the original and no more than :window_hours later (inclusive).
--
-- Parameters (named, bound by the backend; defaults used by the dashboard: 10 % / 24 h):
--   :tolerance_pct  – allowed difference as a percentage of the ORIGINAL amount
--   :window_hours   – maximum gap between the two transfers
--
-- Rules / assumptions:
--   * failed transfers never moved money, so they are excluded; pending ones are included.
--   * amounts are integer cents and times are compared in whole seconds (unixepoch), so both the
--     10 % check and the 24 h boundary are exact. An earlier version used julianday() fractions,
--     which made an exactly-2h gap fail a 2h window through floating-point rounding.
--   * one outbound transfer can match more than one return – every pair is reported.
SELECT
  o.txn_id                                                          AS outbound_txn,
  r.txn_id                                                          AS return_txn,
  o.from_account                                                    AS account_a,
  o.to_account                                                      AS account_b,
  o.amount_cents                                                    AS amount_sent_cents,
  r.amount_cents                                                    AS amount_returned_cents,
  ROUND(100.0 * (r.amount_cents - o.amount_cents) / o.amount_cents, 2) AS pct_difference,
  o.created_at                                                      AS sent_at,
  r.created_at                                                      AS returned_at,
  ROUND((unixepoch(r.created_at) - unixepoch(o.created_at)) / 3600.0, 2) AS hours_apart
FROM transactions AS o
JOIN transactions AS r
  ON  r.from_account = o.to_account
  AND r.to_account   = o.from_account
  AND r.created_at   >  o.created_at
  AND unixepoch(r.created_at) - unixepoch(o.created_at) <= :window_hours * 3600
  AND ABS(r.amount_cents - o.amount_cents) * 100 <= :tolerance_pct * o.amount_cents
WHERE o.status <> 'failed'
  AND r.status <> 'failed'
ORDER BY o.created_at, r.created_at;
