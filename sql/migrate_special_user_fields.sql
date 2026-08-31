-- Lets the admin panel create a "special user" directly (first/last name,
-- email, password, follower/following counts) instead of only being able
-- to flag an existing self-registered user as special.
--
-- Safe to re-run: each ALTER checks information_schema first.

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'followers_count'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN followers_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER is_special',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'following_count'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN following_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER followers_count',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
