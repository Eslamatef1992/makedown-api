-- Explicit tier/level ranking for packages, independent of price or
-- sort_order. Lets the frontend (web + Flutter) know which package is the
-- "top" one (show Renew only) vs. one with valid upgrade paths (show Renew +
-- Upgrade) without guessing from price. Suggested convention:
-- 1 = Standard, 2 = Premium, 3 = VIP — add higher numbers later if needed,
-- the API just returns the raw integer.
--
-- Every existing package defaults to tier 1 (Standard) — after running this,
-- open Packages in the admin panel and set the correct tier on each package
-- (e.g. your VIP package should be tier 3), otherwise every package will
-- look like the top tier until you do.
ALTER TABLE packages
  ADD COLUMN tier TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER sort_order;
