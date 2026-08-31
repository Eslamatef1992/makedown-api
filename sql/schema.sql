-- ============================================================
-- Make Down — MySQL schema
-- Charset: utf8mb4 throughout for full emoji/Arabic support
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------- Auth / Users ----------

CREATE TABLE IF NOT EXISTS users (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid              CHAR(36) NOT NULL UNIQUE,
  full_name         VARCHAR(150) NOT NULL,
  first_name        VARCHAR(100) NULL,
  last_name         VARCHAR(100) NULL,
  birth_date        DATE NULL,
  email             VARCHAR(190) NOT NULL UNIQUE,
  phone             VARCHAR(30) NULL,
  country_code      VARCHAR(5) NULL DEFAULT 'KWT',
  password_hash     VARCHAR(255) NOT NULL,
  avatar_url        VARCHAR(500) NULL,
  bio               VARCHAR(500) NULL,
  email_verified_at DATETIME NULL,
  phone_verified_at DATETIME NULL,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  is_special        TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at     DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS otp_codes (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,
  email       VARCHAR(190) NULL,
  phone       VARCHAR(30) NULL,
  code        VARCHAR(10) NOT NULL,
  purpose     ENUM('register','login','reset_password','change_email') NOT NULL,
  expires_at  DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_otp_lookup (email, purpose, consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  user_agent  VARCHAR(255) NULL,
  ip_address  VARCHAR(64) NULL,
  expires_at  DATETIME NOT NULL,
  revoked_at  DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS addresses (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  label       VARCHAR(60) NULL,
  full_name   VARCHAR(150) NOT NULL,
  phone       VARCHAR(30) NOT NULL,
  country     VARCHAR(80) NOT NULL DEFAULT 'Kuwait',
  city        VARCHAR(100) NULL,
  area        VARCHAR(100) NULL,
  block       VARCHAR(30) NULL,
  street      VARCHAR(150) NULL,
  building    VARCHAR(60) NULL,
  floor       VARCHAR(30) NULL,
  apartment   VARCHAR(30) NULL,
  is_default  TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_addr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Admin / RBAC ----------

CREATE TABLE IF NOT EXISTS roles (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS permissions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name    VARCHAR(120) NOT NULL UNIQUE,
  module      VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admins (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url    VARCHAR(500) NULL,
  role_id       INT UNSIGNED NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- E-commerce ----------

CREATE TABLE IF NOT EXISTS product_categories (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id  INT UNSIGNED NULL,
  name_en    VARCHAR(120) NOT NULL,
  name_ar    VARCHAR(120) NOT NULL DEFAULT '',
  slug       VARCHAR(150) NOT NULL UNIQUE,
  image_url  VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_pcat_parent FOREIGN KEY (parent_id) REFERENCES product_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id   INT UNSIGNED NULL,
  name_en       VARCHAR(200) NOT NULL,
  name_ar       VARCHAR(200) NOT NULL DEFAULT '',
  slug          VARCHAR(220) NOT NULL UNIQUE,
  description_en TEXT NULL,
  description_ar TEXT NULL,
  base_price    DECIMAL(10,3) NOT NULL DEFAULT 0,
  currency      CHAR(3) NOT NULL DEFAULT 'KWD',
  thumbnail_url VARCHAR(500) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_prod_cat FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_images (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  image_url  VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_pimg_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_variants (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id        BIGINT UNSIGNED NOT NULL,
  sku               VARCHAR(80) NOT NULL UNIQUE,
  attributes_json    JSON NULL,
  price             DECIMAL(10,3) NOT NULL,
  compare_at_price  DECIMAL(10,3) NULL,
  stock_quantity    INT NOT NULL DEFAULT 0,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_pvar_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS carts (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,
  guest_token CHAR(36) NULL UNIQUE,
  currency    CHAR(3) NOT NULL DEFAULT 'KWD',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cart_items (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id    BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NULL,
  quantity   INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,3) NOT NULL,
  CONSTRAINT fk_ci_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_var FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coupons (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(50) NOT NULL UNIQUE,
  type           ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
  value          DECIMAL(10,3) NOT NULL,
  min_subtotal   DECIMAL(10,3) NULL,
  max_uses       INT UNSIGNED NULL,
  used_count     INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at     DATETIME NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number          VARCHAR(40) NOT NULL UNIQUE,
  user_id               BIGINT UNSIGNED NULL,
  guest_name            VARCHAR(150) NULL,
  guest_email           VARCHAR(190) NULL,
  guest_phone           VARCHAR(30) NULL,
  status                ENUM('pending','paid','processing','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
  payment_status        ENUM('unpaid','paid','failed','refunded') NOT NULL DEFAULT 'unpaid',
  payment_method        VARCHAR(40) NULL,
  payment_reference     VARCHAR(150) NULL,
  subtotal              DECIMAL(10,3) NOT NULL DEFAULT 0,
  discount_total        DECIMAL(10,3) NOT NULL DEFAULT 0,
  shipping_total        DECIMAL(10,3) NOT NULL DEFAULT 0,
  grand_total           DECIMAL(10,3) NOT NULL DEFAULT 0,
  currency              CHAR(3) NOT NULL DEFAULT 'KWD',
  coupon_id             BIGINT UNSIGNED NULL,
  coupon_code           VARCHAR(50) NULL,
  shipping_address_json JSON NULL,
  billing_address_json  JSON NULL,
  notes                 VARCHAR(500) NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id              BIGINT UNSIGNED NOT NULL,
  product_id            BIGINT UNSIGNED NULL,
  variant_id            BIGINT UNSIGNED NULL,
  product_name_snapshot VARCHAR(200) NOT NULL,
  quantity              INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price            DECIMAL(10,3) NOT NULL,
  line_total            DECIMAL(10,3) NOT NULL,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Packages / game credits ----------

CREATE TABLE IF NOT EXISTS packages (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name_en        VARCHAR(150) NOT NULL,
  name_ar        VARCHAR(150) NOT NULL DEFAULT '',
  description_en TEXT NULL,
  description_ar TEXT NULL,
  price          DECIMAL(10,3) NOT NULL,
  currency       CHAR(3) NOT NULL DEFAULT 'KWD',
  credits        INT UNSIGNED NOT NULL DEFAULT 0,
  validity_days  INT UNSIGNED NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_packages (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL,
  package_id        INT UNSIGNED NOT NULL,
  order_id          BIGINT UNSIGNED NULL,
  credits_remaining INT UNSIGNED NOT NULL DEFAULT 0,
  purchased_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at        DATETIME NULL,
  status            ENUM('active','expired','used') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_up_pkg FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_up_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Schools ----------

CREATE TABLE IF NOT EXISTS schools (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name_en       VARCHAR(200) NOT NULL,
  name_ar       VARCHAR(200) NOT NULL DEFAULT '',
  code          VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  logo_url      VARCHAR(500) NULL,
  address       VARCHAR(255) NULL,
  contact_email VARCHAR(190) NULL,
  contact_phone VARCHAR(30) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Game / quiz engine ----------

CREATE TABLE IF NOT EXISTS game_categories (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id  INT UNSIGNED NULL,
  name_en    VARCHAR(120) NOT NULL,
  name_ar    VARCHAR(120) NOT NULL DEFAULT '',
  slug       VARCHAR(150) NOT NULL UNIQUE,
  icon_url   VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_gcat_parent FOREIGN KEY (parent_id) REFERENCES game_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quizzes (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id         INT UNSIGNED NULL,
  title_en            VARCHAR(200) NOT NULL,
  title_ar            VARCHAR(200) NOT NULL DEFAULT '',
  description_en      TEXT NULL,
  description_ar      TEXT NULL,
  cover_image_url     VARCHAR(500) NULL,
  difficulty          ENUM('easy','medium','hard') NOT NULL DEFAULT 'easy',
  created_by_admin_id BIGINT UNSIGNED NULL,
  is_active           TINYINT(1) NOT NULL DEFAULT 1,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_quiz_cat FOREIGN KEY (category_id) REFERENCES game_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_quiz_admin FOREIGN KEY (created_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quiz_questions (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id              BIGINT UNSIGNED NOT NULL,
  question_text_en     VARCHAR(500) NOT NULL,
  question_text_ar     VARCHAR(500) NOT NULL DEFAULT '',
  question_image_url   VARCHAR(500) NULL,
  question_type        ENUM('text','image','qr','audio') NOT NULL DEFAULT 'text',
  media_url             VARCHAR(500) NULL,
  options_json_en      JSON NOT NULL,
  options_json_ar      JSON NULL,
  correct_option_index TINYINT UNSIGNED NOT NULL,
  points               INT UNSIGNED NOT NULL DEFAULT 100,
  time_limit_seconds   INT UNSIGNED NOT NULL DEFAULT 20,
  sort_order           INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_qq_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_sessions (
  id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id                 BIGINT UNSIGNED NULL,
  title                   VARCHAR(150) NULL,
  host_user_id            BIGINT UNSIGNED NULL,
  school_id               INT UNSIGNED NULL,
  mode                    ENUM('solo','team','random') NOT NULL DEFAULT 'solo',
  audience                ENUM('girls','boys','mixed') NULL,
  is_public               TINYINT(1) NOT NULL DEFAULT 0,
  max_players             TINYINT UNSIGNED NULL,
  scheduled_date          DATE NULL,
  scheduled_time          TIME NULL,
  join_code               VARCHAR(12) NOT NULL UNIQUE,
  qr_code_url             VARCHAR(500) NULL,
  status                  ENUM('waiting','active','finished','cancelled') NOT NULL DEFAULT 'waiting',
  turn_order_json         JSON NULL,
  current_turn_index      INT UNSIGNED NOT NULL DEFAULT 0,
  current_question_id     BIGINT UNSIGNED NULL,
  turn_started_at         DATETIME NULL,
  turn_ends_at            DATETIME NULL,
  current_scan_token      VARCHAR(64) NULL,
  current_scan_scanned_at DATETIME NULL,
  started_at              DATETIME NULL,
  ended_at                DATETIME NULL,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gs_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT fk_gs_host FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_gs_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
  CONSTRAINT fk_gs_current_question FOREIGN KEY (current_question_id) REFERENCES quiz_questions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Board columns: which quizzes (categories) a session's board is built from,
-- i.e. the "specialize" step where a school/host picks categories.
CREATE TABLE IF NOT EXISTS game_session_categories (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  quiz_id    BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_gsc_session_quiz (session_id, quiz_id),
  CONSTRAINT fk_gsc_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_gsc_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_teams (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  name       VARCHAR(80) NOT NULL,
  color      VARCHAR(20) NULL,
  capacity   SMALLINT UNSIGNED NULL,
  score      INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_gt_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_participants (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NULL,
  guest_name VARCHAR(100) NULL,
  team_id    BIGINT UNSIGNED NULL,
  score      INT NOT NULL DEFAULT 0,
  joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at    DATETIME NULL,
  CONSTRAINT fk_gp_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_gp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_gp_team FOREIGN KEY (team_id) REFERENCES game_teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_answers (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id            BIGINT UNSIGNED NOT NULL,
  participant_id        BIGINT UNSIGNED NOT NULL,
  question_id           BIGINT UNSIGNED NOT NULL,
  selected_option_index TINYINT UNSIGNED NULL,
  is_correct            TINYINT(1) NOT NULL DEFAULT 0,
  time_taken_ms         INT UNSIGNED NULL,
  answered_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ga_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ga_participant FOREIGN KEY (participant_id) REFERENCES game_participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_ga_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One-time-per-game lifeline usage (50/50, skip, phone-a-friend).
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

-- Phone-a-friend: a live in-session request/response between two
-- participants (the "friend" sees the live question and suggests an answer).
CREATE TABLE IF NOT EXISTS game_lifeline_requests (
  id                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id               BIGINT UNSIGNED NOT NULL,
  requester_participant_id BIGINT UNSIGNED NOT NULL,
  target_participant_id    BIGINT UNSIGNED NOT NULL,
  question_id              BIGINT UNSIGNED NOT NULL,
  status                   ENUM('pending','answered','expired','cancelled') NOT NULL DEFAULT 'pending',
  suggested_option_index   TINYINT UNSIGNED NULL,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at             DATETIME NULL,
  CONSTRAINT fk_glr_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_glr_requester FOREIGN KEY (requester_participant_id) REFERENCES game_participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_glr_target FOREIGN KEY (target_participant_id) REFERENCES game_participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_glr_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Invites: username-search invite flow from the "Game Link" modal.
CREATE TABLE IF NOT EXISTS game_invites (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id      BIGINT UNSIGNED NOT NULL,
  inviter_user_id BIGINT UNSIGNED NOT NULL,
  invitee_user_id BIGINT UNSIGNED NOT NULL,
  status          ENUM('pending','accepted','declined','expired') NOT NULL DEFAULT 'pending',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at    DATETIME NULL,
  UNIQUE KEY uq_invite_once (session_id, invitee_user_id),
  CONSTRAINT fk_ginv_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ginv_inviter FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ginv_invitee FOREIGN KEY (invitee_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Manual host score adjustments (the +/- controls on the points board).
CREATE TABLE IF NOT EXISTS game_score_adjustments (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id          BIGINT UNSIGNED NOT NULL,
  participant_id      BIGINT UNSIGNED NOT NULL,
  delta               INT NOT NULL,
  adjusted_by_user_id BIGINT UNSIGNED NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gsa_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_gsa_participant FOREIGN KEY (participant_id) REFERENCES game_participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_gsa_admin FOREIGN KEY (adjusted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Social / chat ----------

CREATE TABLE IF NOT EXISTS follows (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  follower_id  BIGINT UNSIGNED NOT NULL,
  following_id BIGINT UNSIGNED NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_follow (follower_id, following_id),
  CONSTRAINT fk_follow_follower FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_follow_following FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_threads (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  is_group   TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_participants (
  thread_id BIGINT UNSIGNED NOT NULL,
  user_id   BIGINT UNSIGNED NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_id, user_id),
  CONSTRAINT fk_cp_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_messages (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_id      BIGINT UNSIGNED NOT NULL,
  sender_id      BIGINT UNSIGNED NOT NULL,
  message        TEXT NULL,
  attachment_url VARCHAR(500) NULL,
  sent_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at        DATETIME NULL,
  CONSTRAINT fk_cm_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- CMS / misc ----------

CREATE TABLE IF NOT EXISTS cms_pages (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug                VARCHAR(80) NOT NULL UNIQUE,
  title_en            VARCHAR(200) NOT NULL,
  title_ar            VARCHAR(200) NOT NULL DEFAULT '',
  content_html_en     LONGTEXT NULL,
  content_html_ar     LONGTEXT NULL,
  updated_by_admin_id BIGINT UNSIGNED NULL,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cms_admin FOREIGN KEY (updated_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS faqs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_en VARCHAR(300) NOT NULL,
  question_ar VARCHAR(300) NOT NULL DEFAULT '',
  answer_en  TEXT NOT NULL,
  answer_ar  TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS social_links (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform   VARCHAR(60) NOT NULL,
  url        VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key   VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_messages (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(190) NOT NULL,
  phone      VARCHAR(30) NULL,
  subject    VARCHAR(200) NULL,
  message    TEXT NOT NULL,
  status     ENUM('new','read','replied') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
