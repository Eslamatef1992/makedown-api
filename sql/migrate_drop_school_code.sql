-- Drops schools.code, which the app stopped using when school login moved
-- to contact_email + password (see admin-auth.service.js / schools
-- controller/repository). The column was still `VARCHAR(30) NOT NULL
-- UNIQUE` with no default on the live schema — nothing was wrong with the
-- app code, but MySQL rejects an INSERT that omits a NOT NULL column with
-- no default, so every "Add new school" failed with a raw
-- "Field 'code' doesn't have a default value" error (surfaced to the admin
-- panel as a generic "Internal server error", since it's not an ApiError
-- the backend recognizes). Editing an existing school never hit this,
-- since UPDATE only touches columns actually being changed.
--
-- Safe to re-run: checks information_schema first, so running this twice
-- (or against a DB where it already applied) is a no-op.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schools' AND COLUMN_NAME = 'code'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE schools DROP COLUMN code',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
