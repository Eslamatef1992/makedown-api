// One-off: dump the live packages table exactly as GET /packages would
// compute it (tier/tierName/upgradableTo), so we can see the real current
// state before deciding what the VIP (tier 3) row needs. Read-only.
// Usage: node scripts/list-packages.js
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function main() {
  const connection = await mysql.createConnection({
    host: env.db.host, port: env.db.port, database: env.db.database,
    user: env.db.user, password: env.db.password,
  });
  try {
    const [rows] = await connection.query(
      `SELECT id, name_en, name_ar, price, currency, credits, free_credits, tier, is_active, sort_order
       FROM packages ORDER BY sort_order ASC, id ASC`
    );
    console.log('=== all packages (including inactive) ===');
    console.log(rows);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('List failed:', err.message);
  process.exit(1);
});
