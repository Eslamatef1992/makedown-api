-- Lets a "Color" variant type's values carry a real hex swatch color
-- (picked from a color input in the admin panel) instead of relying on the
-- text label happening to be a valid CSS color name. Generated variants for
-- a color type now store this hex value as the attribute, so the website's
-- color swatches (ProductDetailPage / CartPage / OrderResultPage, which all
-- render `style={{ backgroundColor: <attribute value> }}`) show the real
-- picked color instead of whatever text was typed as the label.
--
-- Safe to re-run: the ALTER checks information_schema first.

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'variant_type_values' AND COLUMN_NAME = 'hex_color'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE variant_type_values ADD COLUMN hex_color VARCHAR(7) NULL AFTER value_ar',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
