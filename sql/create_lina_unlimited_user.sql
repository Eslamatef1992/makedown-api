-- ============================================================
-- One-time setup: create the "Lina" account with unlimited games.
-- Run once against the Make Down database:
--   mysql -u makedown_user -p makedown < sql/create_lina_unlimited_user.sql
--
-- What this does:
--   1) Creates a hidden internal "package" row with a very large credit
--      balance (is_active = 0, so it never shows up in the public
--      packages/store list — it only exists to hold Lina's credits).
--   2) Creates Lina's user account, already email-verified and active,
--      so she can log in immediately at Lina@makedown.com — same
--      approach the admin panel's "create special user" endpoint uses.
--   3) Grants her account that internal package, so
--      packages.repository.js's consumeGameCredit() always finds
--      credits available and she never hits the "used your free game"
--      (402) wall. This is a very large counted balance (1,000,000
--      games), not a literal infinite flag — the codebase has no such
--      flag; a package is purely credit-count based. At normal play
--      rates this will never run out.
--
-- Safe to run only once: re-running it will fail on the UNIQUE email
-- constraint on step 2 rather than silently duplicating the account.
-- ============================================================

-- 1) Hidden internal package
INSERT INTO packages
  (name_en, name_ar, description_en, description_ar, price, currency, credits, free_credits, is_active, sort_order)
SELECT
  'Unlimited (Internal)', 'غير محدود (داخلي)',
  'Internal account — not for sale', 'حساب داخلي - غير متاح للبيع',
  0.000, 'KWD', 1000000, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name_en = 'Unlimited (Internal)');

-- 2) Lina's account (password hash below is bcrypt("12345678", cost 10) —
--    generated the same way auth.service.js hashes every other password)
INSERT INTO users
  (uuid, full_name, first_name, email, password_hash, email_verified_at, is_active)
VALUES (
  '645fd712-a1b3-44bc-b8b5-789715280c28',
  'Lina',
  'Lina',
  'Lina@makedown.com',
  '$2b$10$99oSiflFjjc4OozfF67lRe7qA4eEcwTrdj1EBNeSpRHL.hXge5lGq',
  NOW(),
  1
);

-- 3) Grant her the unlimited package
INSERT INTO user_packages (user_id, package_id, credits_remaining, status)
SELECT
  (SELECT id FROM users WHERE email = 'Lina@makedown.com'),
  (SELECT id FROM packages WHERE name_en = 'Unlimited (Internal)' LIMIT 1),
  1000000,
  'active';
