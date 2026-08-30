-- Bilingual content migration: splits every customer-facing text field into
-- _en/_ar pairs. Safe to run once against an existing database — uses
-- RENAME COLUMN so existing English content is preserved as *_en, and adds
-- *_ar as an empty string/NULL for admins to fill in via the admin panel.
--
-- Run with: mysql -u makedown_user -p makedown < sql/migrate_bilingual.sql

-- ---------- Ecommerce ----------

ALTER TABLE product_categories
  RENAME COLUMN name TO name_en,
  ADD COLUMN name_ar VARCHAR(120) NOT NULL DEFAULT '' AFTER name_en;

ALTER TABLE products
  RENAME COLUMN name TO name_en,
  ADD COLUMN name_ar VARCHAR(200) NOT NULL DEFAULT '' AFTER name_en,
  RENAME COLUMN description TO description_en,
  ADD COLUMN description_ar TEXT NULL AFTER description_en;

-- ---------- Packages ----------

ALTER TABLE packages
  RENAME COLUMN name TO name_en,
  ADD COLUMN name_ar VARCHAR(150) NOT NULL DEFAULT '' AFTER name_en,
  RENAME COLUMN description TO description_en,
  ADD COLUMN description_ar TEXT NULL AFTER description_en;

-- ---------- Education ----------

ALTER TABLE schools
  RENAME COLUMN name TO name_en,
  ADD COLUMN name_ar VARCHAR(200) NOT NULL DEFAULT '' AFTER name_en;

ALTER TABLE game_categories
  RENAME COLUMN name TO name_en,
  ADD COLUMN name_ar VARCHAR(120) NOT NULL DEFAULT '' AFTER name_en;

ALTER TABLE quizzes
  RENAME COLUMN title TO title_en,
  ADD COLUMN title_ar VARCHAR(200) NOT NULL DEFAULT '' AFTER title_en,
  RENAME COLUMN description TO description_en,
  ADD COLUMN description_ar TEXT NULL AFTER description_en;

ALTER TABLE quiz_questions
  RENAME COLUMN question_text TO question_text_en,
  ADD COLUMN question_text_ar VARCHAR(500) NOT NULL DEFAULT '' AFTER question_text_en,
  RENAME COLUMN options_json TO options_json_en,
  ADD COLUMN options_json_ar JSON NULL AFTER options_json_en;

-- ---------- CMS ----------

ALTER TABLE cms_pages
  RENAME COLUMN title TO title_en,
  ADD COLUMN title_ar VARCHAR(200) NOT NULL DEFAULT '' AFTER title_en,
  RENAME COLUMN content_html TO content_html_en,
  ADD COLUMN content_html_ar LONGTEXT NULL AFTER content_html_en;

ALTER TABLE faqs
  RENAME COLUMN question TO question_en,
  ADD COLUMN question_ar VARCHAR(300) NOT NULL DEFAULT '' AFTER question_en,
  RENAME COLUMN answer TO answer_en,
  ADD COLUMN answer_ar TEXT NOT NULL DEFAULT '' AFTER answer_en;
