// SQLite connection using Node's built-in driver (node:sqlite, Node >= 22.13) – no native build step.
// By default the database is in-memory and rebuilt from /database on every start, so the app and
// the tests always begin from the same known data. Set DB_FILE to persist to disk instead.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATABASE_DIR = path.resolve(__dirname, '..', '..', 'database');

function sqlFiles(subdir) {
  const dir = path.join(DATABASE_DIR, subdir);
  return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => path.join(dir, f));
}

function readQuery(name) {
  return fs.readFileSync(path.join(DATABASE_DIR, 'queries', name), 'utf8');
}

let db;

function migrateAndSeed(database) {
  for (const file of sqlFiles('migrations')) database.exec(fs.readFileSync(file, 'utf8'));
  const { n } = database.prepare('SELECT COUNT(*) AS n FROM accounts').get();
  if (n === 0) for (const file of sqlFiles('seeds')) database.exec(fs.readFileSync(file, 'utf8'));
}

function getDb() {
  if (!db) {
    db = new DatabaseSync(process.env.DB_FILE || ':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    migrateAndSeed(db);
  }
  return db;
}

/** Drop everything and reload schema + seed data (used by the test-only reset endpoint). */
function resetDb() {
  const database = getDb();
  database.exec('DROP TABLE IF EXISTS transactions; DROP TABLE IF EXISTS accounts;');
  migrateAndSeed(database);
}

module.exports = { getDb, resetDb, readQuery };
