// One-off diagnostic for the "Cannot add foreign key constraint" error from
// migrate_lifeline_team_scope.sql. Prints exactly what MySQL thinks both
// tables look like, plus the specific engine/type checks that commonly
// cause error 1215, so the real mismatch is visible instead of guessed at.
// Usage: node scripts/diagnose-lifeline-fk.js
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function main() {
  const connection = await mysql.createConnection({
    host: env.db.host, port: env.db.port, database: env.db.database,
    user: env.db.user, password: env.db.password,
  });
  try {
    for (const table of ['game_teams', 'game_participants', 'game_lifeline_usage']) {
      const [rows] = await connection.query(`SHOW CREATE TABLE ${table}`);
      console.log(`\n=== ${table} ===`);
      console.log(rows[0]['Create Table']);
    }
    console.log('\n=== engine/collation check ===');
    const [engineRows] = await connection.query(
      `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('game_teams','game_lifeline_usage')`
    );
    console.log(engineRows);
    const [colRows] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND (TABLE_NAME = 'game_teams' AND COLUMN_NAME = 'id')
         OR (TABLE_NAME = 'game_lifeline_usage' AND COLUMN_NAME = 'team_id')`
    );
    console.log(colRows);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Diagnostic failed:', err.message);
  process.exit(1);
});
