-- 001_create_schema.sql
-- Core schema for the Mock FinTech Transaction Dashboard (SQLite 3.38+).
-- Money is stored as INTEGER cents to avoid floating-point rounding errors.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  account_id    TEXT    PRIMARY KEY CHECK (account_id GLOB 'ACC-[0-9][0-9][0-9][0-9]'),
  holder_name   TEXT    NOT NULL,
  account_type  TEXT    NOT NULL CHECK (account_type IN ('personal', 'business')),
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  txn_id        TEXT    PRIMARY KEY,
  from_account  TEXT    NOT NULL REFERENCES accounts(account_id),
  to_account    TEXT    NOT NULL REFERENCES accounts(account_id),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  currency      TEXT    NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  description   TEXT    NOT NULL DEFAULT '',
  status        TEXT    NOT NULL CHECK (status IN ('completed', 'pending', 'failed')),
  created_at    TEXT    NOT NULL,                       -- UTC, 'YYYY-MM-DD HH:MM:SS'
  CHECK (from_account <> to_account)
);

CREATE INDEX IF NOT EXISTS idx_txn_created   ON transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_txn_from_to   ON transactions (from_account, to_account, created_at);
CREATE INDEX IF NOT EXISTS idx_txn_to        ON transactions (to_account);
CREATE INDEX IF NOT EXISTS idx_txn_status    ON transactions (status);
