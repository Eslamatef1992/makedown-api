-- Live multiplayer game engine: boards (multi-category "Jeopardy" style point
-- tiles), turn order, timers, lifelines (50/50, skip, phone-a-friend),
-- QR-gated questions, audio/image question types, invites, and manual score
-- adjustments. Builds on the existing quizzes / quiz_questions / game_sessions
-- / game_teams / game_participants / game_answers tables.

-- Question media/type -------------------------------------------------------
ALTER TABLE quiz_questions
  ADD COLUMN question_type ENUM('text','image','qr','audio') NOT NULL DEFAULT 'text' AFTER question_image_url,
  ADD COLUMN media_url VARCHAR(500) NULL AFTER question_type;

-- Session live-state, board, and invite settings -----------------------------
ALTER TABLE game_sessions
  ADD COLUMN title VARCHAR(150) NULL AFTER quiz_id,
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER mode,
  ADD COLUMN max_players TINYINT UNSIGNED NULL AFTER is_public,
  ADD COLUMN turn_order_json JSON NULL AFTER status,
  ADD COLUMN current_turn_index INT UNSIGNED NOT NULL DEFAULT 0 AFTER turn_order_json,
  ADD COLUMN current_question_id BIGINT UNSIGNED NULL AFTER current_turn_index,
  ADD COLUMN turn_started_at DATETIME NULL AFTER current_question_id,
  ADD COLUMN turn_ends_at DATETIME NULL AFTER turn_started_at,
  ADD COLUMN current_scan_token VARCHAR(64) NULL AFTER turn_ends_at,
  ADD COLUMN current_scan_scanned_at DATETIME NULL AFTER current_scan_token,
  ADD CONSTRAINT fk_gs_current_question FOREIGN KEY (current_question_id) REFERENCES quiz_questions(id) ON DELETE SET NULL;

-- quiz_id becomes optional: a session's real category set lives in
-- game_session_categories (a board can span many quizzes/categories); the
-- column is kept (legacy single-quiz sessions, e.g. old school exports) but
-- new sessions leave it NULL and use the board table instead.
ALTER TABLE game_sessions MODIFY COLUMN quiz_id BIGINT UNSIGNED NULL;

-- Board columns: which quizzes (categories) a given session's board is built
-- from, i.e. the "specialize" step where a school/host picks categories.
CREATE TABLE IF NOT EXISTS game_session_categories (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  quiz_id    BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_gsc_session_quiz (session_id, quiz_id),
  CONSTRAINT fk_gsc_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_gsc_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Participant lifecycle / disconnect tracking --------------------------------
ALTER TABLE game_participants
  ADD COLUMN left_at DATETIME NULL AFTER joined_at;

-- One-time-per-game lifeline usage (50/50, skip, phone-a-friend) ------------
CREATE TABLE IF NOT EXISTS game_lifeline_usage (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id     BIGINT UNSIGNED NOT NULL,
  participant_id BIGINT UNSIGNED NOT NULL,
  lifeline_type  ENUM('fifty_fifty','skip','phone_a_friend') NOT NULL,
  question_id    BIGINT UNSIGNED NOT NULL,
  used_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gl_once (session_id, participant_id, lifeline_type),
  CONSTRAINT fk_gl_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_gl_participant FOREIGN KEY (participant_id) REFERENCES game_participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_gl_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Phone-a-friend: a real, live in-session request/response between two
-- participants (the "friend" sees the live question and suggests an answer
-- back within the turn's timer).
CREATE TABLE IF NOT EXISTS game_lifeline_requests (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id            BIGINT UNSIGNED NOT NULL,
  requester_participant_id BIGINT UNSIGNED NOT NULL,
  target_participant_id BIGINT UNSIGNED NOT NULL,
  question_id           BIGINT UNSIGNED NOT NULL,
  status                ENUM('pending','answered','expired','cancelled') NOT NULL DEFAULT 'pending',
  suggested_option_index TINYINT UNSIGNED NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at          DATETIME NULL,
  CONSTRAINT fk_glr_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_glr_requester FOREIGN KEY (requester_participant_id) REFERENCES game_participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_glr_target FOREIGN KEY (target_participant_id) REFERENCES game_participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_glr_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Invites: username-search invite flow from the "Game Link" modal ----------
CREATE TABLE IF NOT EXISTS game_invites (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id    BIGINT UNSIGNED NOT NULL,
  inviter_user_id BIGINT UNSIGNED NOT NULL,
  invitee_user_id BIGINT UNSIGNED NOT NULL,
  status        ENUM('pending','accepted','declined','expired') NOT NULL DEFAULT 'pending',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at  DATETIME NULL,
  UNIQUE KEY uq_invite_once (session_id, invitee_user_id),
  CONSTRAINT fk_ginv_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ginv_inviter FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ginv_invitee FOREIGN KEY (invitee_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Manual host score adjustments (the +/- controls on the points board) ------
CREATE TABLE IF NOT EXISTS game_score_adjustments (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id        BIGINT UNSIGNED NOT NULL,
  participant_id    BIGINT UNSIGNED NOT NULL,
  delta             INT NOT NULL,
  adjusted_by_user_id BIGINT UNSIGNED NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gsa_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_gsa_participant FOREIGN KEY (participant_id) REFERENCES game_participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_gsa_admin FOREIGN KEY (adjusted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
