// One-off runner for the sql/migrate_*.sql files in this repo. Those files
// are gitignored (see .gitignore's *.sql) and were always meant to be run
// by hand — this script exists so "by hand" doesn't require knowing the
// DB username/password: it reuses this app's own src/config/env.js, which
// already reads DB_HOST/DB_USER/DB_PASSWORD/etc from the .env sitting next
// to this file on the server (the same .env the running API process uses).
//
// Usage (from the makedown-api directory, on the VPS):
//   node scripts/run-sql-file.js sql/migrate_lifeline_team_scope.sql
//
// Safe to re-run — every migrate_*.sql in this repo checks
// information_schema before altering anything.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/run-sql-file.js <path-to-sql-file>');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

  // A single dedicated connection with multipleStatements on — needed
  // because these migrations use SET @var / PREPARE / EXECUTE / DEALLOCATE,
  // which must all run in the same session (the pool in src/config/db.js
  // doesn't enable multipleStatements, and a connection pool can't
  // guarantee consecutive queries land on the same session anyway).
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  });

  try {
    console.log(`Connected to ${env.db.database}@${env.db.host} as ${env.db.user}. Running ${file} ...`);
    await connection.query(sql);
    console.log('Done.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
