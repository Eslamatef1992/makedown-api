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

// ---- game-credit gating (one free game, then a package is required) ----

// Atomically claims this account's one-time free game. Returns true only for
// the caller that actually flips the flag (WHERE free_game_used_at IS NULL
// keeps this race-safe under concurrent requests); false means it was
// already used, by this call or an earlier one.
async function claimFreeGame(userId) {
  const [result] = await pool.query(
    'UPDATE users SET free_game_used_at = NOW() WHERE id = ? AND free_game_used_at IS NULL',
    [userId]
  );
  return result.affectedRows > 0;
}

// Atomically spends one credit from whichever of the user's active,
// unexpired packages is closest to expiring (use-it-or-lose-it order).
// Returns the user_package row it drew from, or null if the user has no
// usable credits at all.
async function consumeActivePackageCredit(userId) {
  const [candidates] = await pool.query(
    `SELECT id FROM user_packages
     WHERE user_id = ? AND status = 'active' AND credits_remaining > 0
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY (expires_at IS NULL) ASC, expires_at ASC, purchased_at ASC
     LIMIT 1`,
    [userId]
  );
  if (!candidates.length) return null;

  const packageId = candidates[0].id;
  const [result] = await pool.query(
    "UPDATE user_packages SET credits_remaining = credits_remaining - 1 WHERE id = ? AND credits_remaining > 0",
    [packageId]
  );
  if (!result.affectedRows) return null; // lost a race with another request — caller decides what to do
  return findUserPackageById(packageId);
}

// The single gate every "start playing" entry point (create/join a session)
// goes through: spend the account's one free game first, then fall back to
// package credits. Throws Error('NO_GAME_CREDITS') when neither is
// available, for the controller to turn into a friendly 402.
async function consumeGameCredit(userId) {
  const usedFree = await claimFreeGame(userId);
  if (usedFree) return { source: 'free' };

  const userPackage = await consumeActivePackageCredit(userId);
  if (!userPackage) {
    const err = new Error('NO_GAME_CREDITS');
    throw err;
  }
  return { source: 'package', userPackage };
}

module.exports = {
  ...base,
  listActive,
  createUserPackage,
  findUserPackageById,
  findUserPackageByOrderId,
  listUserPackages,
  claimFreeGame,
  consumeActivePackageCredit,
  consumeGameCredit,
};
