-- Adds game_sessions.title_ar so a school's "Create Game" flow can save a
-- bilingual game name (English + Arabic), matching every other
-- user-facing title/name in this app. game_sessions.title stays as the
-- English title column; title_ar is the new Arabic counterpart, NULL for
-- older rows and for non-school sessions that never collect a name.
--
-- Safe to re-run: checks information_schema first, so running this twice
-- (or against a DB where it already applied) is a no-op.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_sessions' AND COLUMN_NAME = 'title_ar'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE game_sessions ADD COLUMN title_ar VARCHAR(150) NULL AFTER title',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
