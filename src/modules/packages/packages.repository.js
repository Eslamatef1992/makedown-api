const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({ table: 'packages', searchableColumns: ['name_en', 'name_ar'], defaultOrderBy: 'sort_order ASC, id ASC' });

// tier is stored/returned as the raw integer (1/2/3) — has been since it
// shipped, other clients may already read it as a number, so it's kept
// as-is. tierName is purely additive: the string name for anyone who'd
// rather not hardcode "2 means Premium" on their own end.
const TIER_NAMES = { 1: 'standard', 2: 'premium', 3: 'vip' };

async function listActive() {
  const [rows] = await pool.query('SELECT * FROM packages WHERE is_active = 1 ORDER BY sort_order ASC, id ASC');
  return attachUpgradableTo(rows);
}

// Every package in a strictly higher tier is a valid upgrade target from
// this one — this is what lets the frontend (web + Flutter) decide "Renew
// only" (already top tier, upgradableTo is empty) vs "Renew + Upgrade"
// without hardcoding a tier order of its own. isRenewable is always true —
// there's no tier restriction on renewing (only on upgrading), a package
// can always be bought again.
function attachUpgradableTo(packages) {
  return packages.map((pkg) => ({
    ...pkg,
    tierName: TIER_NAMES[pkg.tier] || null,
    isRenewable: true,
    upgradableTo: packages.filter((other) => other.tier > pkg.tier).map((other) => other.id),
  }));
}

// ---- user_packages (a customer's purchased credit packages) ----

// Packages are purely game-count based — no date expiry (a deliberate
// product decision — see grantPackage for the other one: buying a new
// package always replaces whatever was active, credits don't carry over).
// A package stays usable until its credits run out, however long that
// takes.
async function createUserPackage({ userId, packageId, orderId, credits }) {
  const [result] = await pool.query('INSERT INTO user_packages SET ?', [
    {
      user_id: userId,
      package_id: packageId,
      order_id: orderId,
      credits_remaining: credits,
      status: 'active',
    },
  ]);
  return findUserPackageById(result.insertId);
}

// Buying a new package (Renew or Upgrade — same endpoint, see
// packages.controller.js#purchase) always leaves exactly one active
// package: any other still-active package for this user is expired first,
// and its leftover credits_remaining are forfeited, not merged or carried
// over. This is the one call site every "credits granted" path (cash,
// and the MyFatoorah callback) must go through instead of calling
// createUserPackage directly, so this rule can never be bypassed.
async function expireOtherActivePackages(userId) {
  await pool.query("UPDATE user_packages SET status = 'expired' WHERE user_id = ? AND status = 'active'", [userId]);
}

async function grantPackage({ userId, packageId, orderId, credits }) {
  await expireOtherActivePackages(userId);
  return createUserPackage({ userId, packageId, orderId, credits });
}

async function findUserPackageById(id) {
  const [rows] = await pool.query(
    `SELECT up.*, p.name_en AS package_name_en, p.name_ar AS package_name_ar, p.credits AS package_credits, p.free_credits AS package_free_credits, p.tier AS package_tier
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
    `SELECT up.*, p.name_en AS package_name_en, p.name_ar AS package_name_ar, p.credits AS package_credits, p.free_credits AS package_free_credits, p.tier AS package_tier
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

// Atomically spends one credit from the user's oldest active package with
// credits left (FIFO — no date expiry involved, packages are purely
// game-count based). Returns the user_package row it drew from, or null if
// the user has no usable credits at all.
async function consumeActivePackageCredit(userId) {
  const [candidates] = await pool.query(
    `SELECT id FROM user_packages
     WHERE user_id = ? AND status = 'active' AND credits_remaining > 0
     ORDER BY purchased_at ASC
     LIMIT 1`,
    [userId]
  );
  if (!candidates.length) return null;

  const packageId = candidates[0].id;
  // Flips to 'used' in the same statement once this spend drains it to 0 —
  // without this, status stayed 'active' forever even at 0 credits, which
  // made "does this user have an active package" unreliable to check by
  // status alone. 'used' means "ran out naturally"; 'expired' (see
  // expireOtherActivePackages) means "superseded by a newer purchase".
  const [result] = await pool.query(
    `UPDATE user_packages
     SET credits_remaining = credits_remaining - 1,
         status = CASE WHEN credits_remaining - 1 <= 0 THEN 'used' ELSE status END
     WHERE id = ? AND credits_remaining > 0`,
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
  expireOtherActivePackages,
  grantPackage,
  findUserPackageById,
  findUserPackageByOrderId,
  listUserPackages,
  claimFreeGame,
  consumeActivePackageCredit,
  consumeGameCredit,
};
