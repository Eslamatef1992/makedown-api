-- Adds game_sessions.card_image_url — a single admin-uploaded "Game Card"
-- image for the whole session (set from the admin panel's Create/Edit Game
-- form), shown as-is on the public school games list (SchoolDetailPage's
-- GameCard) instead of the auto-composed grid of each category's own
-- image, when the admin has uploaded one. NULL for older rows and any
-- session where the admin never set one — the grid remains the fallback.
--
-- Safe to re-run: checks information_schema first, so running this twice
-- (or against a DB where it already applied) is a no-op.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_sessions' AND COLUMN_NAME = 'card_image_url'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE game_sessions ADD COLUMN card_image_url VARCHAR(500) NULL AFTER title_ar',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
