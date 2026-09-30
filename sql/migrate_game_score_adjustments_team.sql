-- Lets a score adjustment target a team directly (game_teams.id) instead of
-- always requiring a participant_id, for the new teamId support in
-- POST /play/sessions/:id/score-adjustment. Exactly one of participant_id /
-- team_id is set on any given row going forward; existing rows keep their
-- participant_id and get team_id = NULL.
--
-- Safe to re-run: checks information_schema first, so running this twice
-- (or against a DB where it already applied) is a no-op.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_score_adjustments' AND COLUMN_NAME = 'team_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE game_score_adjustments ADD COLUMN team_id BIGINT UNSIGNED NULL AFTER participant_id, ADD CONSTRAINT fk_gsa_team FOREIGN KEY (team_id) REFERENCES game_teams(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @participant_nullable = (
  SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_score_adjustments' AND COLUMN_NAME = 'participant_id'
);
SET @sql = IF(@participant_nullable = 'NO',
  'ALTER TABLE game_score_adjustments MODIFY COLUMN participant_id BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
