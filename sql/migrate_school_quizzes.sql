-- School Games: lets a school author its own private games/questions
-- (separate from the global Make Down Games catalog, which stays
-- school_id IS NULL) and bundle a selection of them into a scheduled
-- game_sessions row via the existing game_session_categories join table —
-- no other schema change is needed for the scheduling/join-code/team side,
-- that already exists (game_sessions.school_id, join_code, game_teams).
ALTER TABLE quizzes
  ADD COLUMN school_id INT UNSIGNED NULL AFTER category_id,
  ADD CONSTRAINT fk_quiz_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

CREATE INDEX idx_quizzes_school ON quizzes (school_id);
