-- Lets the super admin decide, per game/quiz, whether it can be played
-- Solo, Team, or both — so the category picker on the website only offers
-- a game for the mode the player actually chose (Solo vs Team).
--
-- Safe to re-run: the ALTER checks information_schema first.

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quizzes' AND COLUMN_NAME = 'supported_modes'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE quizzes ADD COLUMN supported_modes ENUM('solo','team','both') NOT NULL DEFAULT 'both' AFTER difficulty",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
