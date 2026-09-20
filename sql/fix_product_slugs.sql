-- One-time cleanup: normalize the slugs of the 3 products that were
-- created before slugs got auto-normalized on save (see
-- products.controller.js's transformInput). Matches exactly what
-- `SELECT id, name_en, slug, is_active FROM products ORDER BY id;`
-- showed on 2026-09-20 — safe to run once.
UPDATE products SET slug = 'makedown-camera'    WHERE id = 1;
UPDATE products SET slug = 'make-down-case'     WHERE id = 2;
UPDATE products SET slug = 'makedown-og-hoodie' WHERE id = 3;
