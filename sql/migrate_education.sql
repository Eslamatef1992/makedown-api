-- Education flow: schools log in and self-serve their own games.
-- Builds on the existing schools / game_sessions / game_teams tables (see
-- migrate_game_engine.sql for the "school picks categories, gets a join
-- code" flow this extends).

-- Schools can now authenticate (same login screen as admins — the backend
-- tries the admins table by email first, then the schools table by code).
ALTER TABLE schools
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER code;

-- Scheduling + audience targeting for a school's game (matches the
-- "ACA School Games" cards: Game Name, Only Girl/Only Boy/Boy&Girl, date,
-- time, Team1 vs Team2).
ALTER TABLE game_sessions
  ADD COLUMN audience ENUM('girls','boys','mixed') NULL AFTER mode,
  ADD COLUMN scheduled_date DATE NULL AFTER max_players,
  ADD COLUMN scheduled_time TIME NULL AFTER scheduled_date;

-- Teams get a real name (not just "Team A"/"Team B") and a declared player
-- capacity, shown on the website as "Team1 20 Players Vs Team2 20 Players".
ALTER TABLE game_teams
  ADD COLUMN capacity SMALLINT UNSIGNED NULL AFTER name;
