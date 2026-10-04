// One-off diagnostic for the "Cannot add foreign key constraint" error from
// migrate_lifeline_team_scope.sql. MySQL's client-facing error (1215) never
// says why — the real reason lives in SHOW ENGINE INNODB STATUS's "LATEST
// FOREIGN KEY ERROR" section. This also re-runs the exact same
// information_schema check the migration uses to decide whether to skip
// the fk_gl_team step, so we know for certain whether it's even attempting
// it again or failing on a later statement instead.
// Usage: node scripts/diagnose-lifeline-fk.js
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function main() {
  const connection = await mysql.createConnection({
    host: env.db.host, port: env.db.port, database: env.db.database,
    user: env.db.user, password: env.db.password,
  });
  try {
    console.log('=== does the migration think fk_gl_team already exists? ===');
    const [fkCheck] = await connection.query(
      `SELECT COUNT(*) AS fk_exists FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_lifeline_usage' AND CONSTRAINT_NAME = 'fk_gl_team'`
    );
    console.log(fkCheck);

    console.log('\n=== does scope_id column exist? ===');
    const [colCheck] = await connection.query(
      `SELECT COUNT(*) AS col_exists FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_lifeline_usage' AND COLUMN_NAME = 'scope_id'`
    );
    console.log(colCheck);

    console.log('\n=== attempting the exact scope_id ALTER by itself, to isolate it ===');
    try {
      await connection.query(
        'ALTER TABLE game_lifeline_usage ADD COLUMN scope_id BIGINT UNSIGNED GENERATED ALWAYS AS (COALESCE(team_id, participant_id)) STORED AFTER team_id'
      );
      console.log('scope_id ALTER: SUCCEEDED');
    } catch (err) {
      console.log('scope_id ALTER FAILED:', err.message);
    }

    console.log('\n=== SHOW ENGINE INNODB STATUS — LATEST FOREIGN KEY ERROR ===');
    const [statusRows] = await connection.query('SHOW ENGINE INNODB STATUS');
    const status = statusRows[0].Status;
    const marker = 'LATEST FOREIGN KEY ERROR';
    const idx = status.indexOf(marker);
    if (idx === -1) {
      console.log('(no LATEST FOREIGN KEY ERROR section found — the last failure may predate this check, or InnoDB status log rotated)');
    } else {
      const nextSectionIdx = status.indexOf('------------', idx + marker.length);
      console.log(status.slice(idx, nextSectionIdx !== -1 ? nextSectionIdx : idx + 2000));
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Diagnostic failed:', err.message);
  process.exit(1);
});
