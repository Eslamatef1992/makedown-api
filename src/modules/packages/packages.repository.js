const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({ table: 'packages', searchableColumns: ['name_en', 'name_ar'], defaultOrderBy: 'sort_order ASC, id ASC' });

async function listActive() {
  const [rows] = await pool.query('SELECT * FROM packages WHERE is_active = 1 ORDER BY sort_order ASC, id ASC');
  return rows;
}

// ---- user_packages (a customer's purchased credit packages) ----

async function createUserPackage({ userId, packageId, orderId, credits, validityDays }) {
  const expiresAt = validityDays
    ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
    : null;
  const [result] = await pool.query('INSERT INTO user_packages SET ?', [
    {
      user_id: userId,
      package_id: packageId,
      order_id: orderId,
      credits_remaining: credits,
      expires_at: expiresAt,
      status: 'active',
    },
  ]);
  return findUserPackageById(result.insertId);
}

async function findUserPackageById(id) {
  const [rows] = await pool.query(
    `SELECT up.*, p.name_en AS package_name_en, p.name_ar AS package_name_ar, p.credits AS package_credits, p.free_credits AS package_free_credits
     FROM user_packages up JOIN packages p ON p.id = up.package_id
     WHERE up.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findUserPackageByOrderId(orderId) {
  const [rows] = await pool.query('SELECT * FROM user_packages WHERE order_id = ? LIMIT 1', [orderId]);
  return rows[0] || null;
}

// The customer's current (most recently active, non-expired) package, plus
// full purchase history — used by the My Profile page.
async function listUserPackages(userId) {
  const [rows] = await pool.query(
    `SELECT up.*, p.name_en AS package_name_en, p.name_ar AS package_name_ar, p.credits AS package_credits, p.free_credits AS package_free_credits
     FROM user_packages up JOIN packages p ON p.id = up.package_id
     WHERE up.user_id = ?
     ORDER BY up.purchased_at DESC`,
    [userId]
  );
  return rows;
}

module.exports = {
  ...base,
  listActive,
  createUserPackage,
  findUserPackageById,
  findUserPackageByOrderId,
  listUserPackages,
};
