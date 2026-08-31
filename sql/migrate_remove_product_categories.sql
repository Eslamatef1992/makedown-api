-- Ecommerce products are no longer organized by category — the admin panel
-- never actually surfaced this field on the product form, and it's being
-- dropped rather than left as unused dead weight in the schema.
ALTER TABLE products DROP FOREIGN KEY fk_prod_cat;
ALTER TABLE products DROP COLUMN category_id;
DROP TABLE IF EXISTS product_categories;
