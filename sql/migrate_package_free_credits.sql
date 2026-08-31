-- A package's "credits" is the paid game allotment; "free_credits" is an
-- extra bonus games count an admin can layer on top (e.g. "10 Games + 2
-- Games Free"). Both are summed into user_packages.credits_remaining when
-- a package is purchased.
ALTER TABLE packages
  ADD COLUMN free_credits INT UNSIGNED NOT NULL DEFAULT 0 AFTER credits;
