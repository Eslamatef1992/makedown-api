-- Adds game_sessions.timer_paused_at and game_sessions.timer_remaining_seconds
-- so the host can pause/resume/reset a question's countdown from the server
-- side, not just on the device. When timer_paused_at is set, the server
-- stops treating turn_ends_at as expired (see play.repository.js's
-- TIME_EXPIRED check) and remembers how many seconds were left in
-- timer_remaining_seconds, so resuming can recompute a fresh turn_ends_at
-- instead of the countdown silently continuing while "paused".
--
-- Safe to re-run: checks information_schema first, so running this twice
-- (or against a DB where it already applied) is a no-op.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_sessions' AND COLUMN_NAME = 'timer_paused_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE game_sessions ADD COLUMN timer_paused_at DATETIME NULL AFTER turn_ends_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_sessions' AND COLUMN_NAME = 'timer_remaining_seconds'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE game_sessions ADD COLUMN timer_remaining_seconds INT UNSIGNED NULL AFTER timer_paused_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
