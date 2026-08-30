-- Small key/value table for singleton site settings, starting with the
-- Home page's "Home Page Video" YouTube URL managed from the admin CMS.
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key   VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
