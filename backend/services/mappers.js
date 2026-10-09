// DB row -> API representation. Amounts are exposed in dollars (2 dp), times as ISO-8601 UTC.
const toIso = (s) => `${s.replace(' ', 'T')}Z`;
const toAmount = (cents) => Math.round(cents) / 100;

const mapTransaction = (r) => ({
  id: r.txn_id,
  fromAccount: r.from_account,
  toAccount: r.to_account,
  amount: toAmount(r.amount_cents),
  currency: r.currency,
  description: r.description,
  status: r.status,
  createdAt: toIso(r.created_at),
});

module.exports = { mapTransaction, toIso, toAmount };
