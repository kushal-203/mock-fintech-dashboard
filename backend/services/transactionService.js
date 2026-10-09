const { getDb } = require('../db/connection');
const { unprocessable } = require('../middleware/errors');
const { mapTransaction } = require('./mappers');

const SORT_COLUMNS = { date: 'created_at', amount: 'amount_cents' }; // whitelist – never interpolate user input

function listTransactions({ page, pageSize, sortBy, order, account, status, search }) {
  const db = getDb();
  const where = [];
  const params = {};
  if (account) { where.push('(from_account = :account OR to_account = :account)'); params.account = account; }
  if (status) { where.push('status = :status'); params.status = status; }
  if (search) {
    where.push("(txn_id LIKE :search ESCAPE '\\' OR description LIKE :search ESCAPE '\\' OR from_account LIKE :search ESCAPE '\\' OR to_account LIKE :search ESCAPE '\\')");
    params.search = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  const orderSql = `ORDER BY ${SORT_COLUMNS[sortBy]} ${dir}, txn_id ${dir}`;

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM transactions ${whereSql}`).get(params);
  const rows = db.prepare(`SELECT * FROM transactions ${whereSql} ${orderSql} LIMIT :limit OFFSET :offset`)
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

  return {
    data: rows.map(mapTransaction),
    pagination: { page, pageSize, totalItems: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    sort: { sortBy, order },
    filters: { account, status, search },
  };
}

function nextTxnId(db) {
  const { maxId } = db.prepare("SELECT MAX(CAST(SUBSTR(txn_id, 5) AS INTEGER)) AS maxId FROM transactions").get();
  return `TXN-${String((maxId || 0) + 1).padStart(6, '0')}`;
}

/** Executes a transfer atomically: checks accounts and funds, moves the money, records the transaction. */
function createTransfer({ fromAccount, toAccount, amountCents, description }) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const getAcc = db.prepare('SELECT * FROM accounts WHERE account_id = ?');
    const from = getAcc.get(fromAccount);
    const to = getAcc.get(toAccount);
    const missing = [[fromAccount, from, 'fromAccount'], [toAccount, to, 'toAccount']].filter(([, a]) => !a);
    if (missing.length) {
      throw unprocessable('ACCOUNT_NOT_FOUND', 'Account not found',
        missing.map(([id, , field]) => ({ field, message: `Account ${id} does not exist` })));
    }
    const frozen = [[from, 'fromAccount'], [to, 'toAccount']].filter(([a]) => a.status !== 'active');
    if (frozen.length) {
      throw unprocessable('ACCOUNT_FROZEN', 'Account is frozen',
        frozen.map(([a, field]) => ({ field, message: `Account ${a.account_id} is frozen` })));
    }
    if (from.balance_cents < amountCents) {
      throw unprocessable('INSUFFICIENT_FUNDS', 'Insufficient funds',
        [{ field: 'amount', message: `Available balance is ${(from.balance_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` }]);
    }

    const id = nextTxnId(db);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE account_id = ?').run(amountCents, fromAccount);
    db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE account_id = ?').run(amountCents, toAccount);
    db.prepare(`INSERT INTO transactions (txn_id, from_account, to_account, amount_cents, currency, description, status, created_at)
                VALUES (?, ?, ?, ?, 'USD', ?, 'completed', ?)`).run(id, fromAccount, toAccount, amountCents, description, now);
    db.exec('COMMIT');
    return mapTransaction(db.prepare('SELECT * FROM transactions WHERE txn_id = ?').get(id));
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function listAccounts() {
  return getDb().prepare('SELECT * FROM accounts ORDER BY account_id').all().map((a) => ({
    id: a.account_id, holderName: a.holder_name, type: a.account_type, status: a.status, balance: a.balance_cents / 100,
  }));
}

module.exports = { listTransactions, createTransfer, listAccounts };
