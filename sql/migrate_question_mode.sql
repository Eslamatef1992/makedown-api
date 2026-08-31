-- Lets a super admin scope an individual question to Solo, Team, or both
-- (a quiz can already be limited to solo/team/both via quizzes.supported_modes;
-- this is the same idea one level down, per question).
ALTER TABLE quiz_questions
  ADD COLUMN mode ENUM('solo','team','both') NOT NULL DEFAULT 'both' AFTER question_type;
