-- Education flow: schools log in and self-serve their own games.
-- Builds on the existing schools / game_sessions / game_teams tables (see
-- migrate_game_engine.sql for the "school picks categories, gets a join
-- code" flow this extends).
--
-- Safe to re-run: every ADD COLUMN below checks information_schema first,
-- so running this twice (or against a DB where it partially applied) is a
-- no-op instead of a "Duplicate column name" error.

-- Schools can now authenticate (same login screen as admins — the backend
-- tries the admins table by email first, then the schools table by code).
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schools' AND COLUMN_NAME = 'password_hash'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE schools ADD COLUMN password_hash VARCHAR(255) NULL AFTER code',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Scheduling + audience targeting for a school's game (matches the
-- "ACA School Games" cards: Game Name, Only Girl/Only Boy/Boy&Girl, date,
-- time, Team1 vs Team2).
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_sessions' AND COLUMN_NAME = 'audience'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE game_sessions ADD COLUMN audience ENUM('girls','boys','mixed') NULL AFTER mode",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_sessions' AND COLUMN_NAME = 'scheduled_date'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE game_sessions ADD COLUMN scheduled_date DATE NULL AFTER max_players',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_sessions' AND COLUMN_NAME = 'scheduled_time'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE game_sessions ADD COLUMN scheduled_time TIME NULL AFTER scheduled_date',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Teams get a real name (not just "Team A"/"Team B") and a declared player
-- capacity, shown on the website as "Team1 20 Players Vs Team2 20 Players".
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_teams' AND COLUMN_NAME = 'capacity'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE game_teams ADD COLUMN capacity SMALLINT UNSIGNED NULL AFTER name',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
