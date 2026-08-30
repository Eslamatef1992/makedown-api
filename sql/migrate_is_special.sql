-- Adds the is_special flag to users. Present in schema.sql but missing on
-- databases created before that column was added.
ALTER TABLE users ADD COLUMN is_special TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;
