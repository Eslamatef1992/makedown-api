-- ============================================================
-- Make Down — baseline seed data
-- Run once after schema.sql, on a fresh database.
-- Creates: default roles/permissions, one super-admin login,
-- and empty CMS page rows so the admin panel has something to edit.
-- ============================================================

SET NAMES utf8mb4;

-- ---------- Roles & permissions ----------

INSERT INTO roles (name, description) VALUES
  ('Super Admin', 'Full access to every module'),
  ('Editor', 'Manage content: CMS, games, products, packages')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO permissions (key_name, module, description) VALUES
  ('dashboard.view', 'dashboard', 'View dashboard'),
  ('admins.manage', 'admins', 'Manage admin accounts'),
  ('roles.manage', 'roles', 'Manage roles & permissions'),
  ('users.manage', 'users', 'Manage users'),
  ('schools.manage', 'education', 'Manage schools'),
  ('games.manage', 'education', 'Manage games/quizzes'),
  ('categories.manage', 'games', 'Manage game categories'),
  ('games-history.view', 'games', 'View games history'),
  ('orders.manage', 'orders', 'Manage orders'),
  ('chat.view', 'chat', 'View chat'),
  ('products.manage', 'ecommerce', 'Manage products & variants'),
  ('packages.manage', 'packages', 'Manage packages'),
  ('contact.manage', 'contact', 'View contact/get-in-touch messages'),
  ('cms.manage', 'cms', 'Manage CMS pages, FAQ, social links')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Super Admin gets every permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Super Admin'), id FROM permissions
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Editor gets content-management permissions only
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Editor'), id FROM permissions
WHERE key_name IN ('dashboard.view', 'games.manage', 'categories.manage', 'products.manage', 'packages.manage', 'cms.manage')
ON DUPLICATE KEY UPDATE role_id = role_id;

-- ---------- First admin login ----------
-- Password below is 'ChangeMe123!' hashed with bcrypt (10 rounds).
-- Log in once and change it, or regenerate the hash yourself:
--   node -e "console.log(require('bcryptjs').hashSync('YourPassword', 10))"

INSERT INTO admins (name, email, password_hash, role_id, is_active)
SELECT 'Super Admin', 'admin@makedown.online',
       '$2b$10$edURFfQ9m5FHJi0yo5RgS.vY4.c8/UWv6u85yD1T79HUIG1V/I1mu',
       (SELECT id FROM roles WHERE name = 'Super Admin'), 1
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE email = 'admin@makedown.online');

-- ---------- CMS pages (empty placeholders — edit content_html from the admin panel) ----------

INSERT INTO cms_pages (slug, title_en, title_ar, content_html_en, content_html_ar) VALUES
  ('about-us', 'About Us', 'من نحن', '<p>Content coming soon.</p>', '<p>المحتوى قادم قريبًا.</p>'),
  ('privacy-policy', 'Privacy Policy', 'سياسة الخصوصية', '<p>Content coming soon.</p>', '<p>المحتوى قادم قريبًا.</p>'),
  ('terms-and-conditions', 'Terms & Conditions', 'الشروط والأحكام', '<p>Content coming soon.</p>', '<p>المحتوى قادم قريبًا.</p>'),
  ('return-policy', 'Return Policy', 'سياسة الإرجاع', '<p>Content coming soon.</p>', '<p>المحتوى قادم قريبًا.</p>'),
  ('how-it-works', 'How It Works', 'كيف يعمل', '<p>Content coming soon.</p>', '<p>المحتوى قادم قريبًا.</p>')
ON DUPLICATE KEY UPDATE title_en = VALUES(title_en);
