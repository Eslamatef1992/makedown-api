-- Every account gets exactly one free game before it must have an active
-- package with credits remaining. This timestamp is set the first time the
-- user creates or joins a game session, atomically (WHERE free_game_used_at
-- IS NULL), so it also doubles as an audit trail of when the free game was
-- spent.
ALTER TABLE users
  ADD COLUMN free_game_used_at DATETIME NULL AFTER last_login_at;
