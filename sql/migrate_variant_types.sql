-- Reusable "variant types" (e.g. Color, Width, Height) with a fixed set of
-- values each, so the admin panel can let a product pick which variant
-- types apply and generate variant combinations, instead of typing a flat
-- attributes JSON blob by hand for every SKU.
CREATE TABLE IF NOT EXISTS variant_types (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name_en     VARCHAR(120) NOT NULL,
  name_ar     VARCHAR(120) NOT NULL,
  slug        VARCHAR(140) NOT NULL UNIQUE,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS variant_type_values (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  variant_type_id BIGINT UNSIGNED NOT NULL,
  value_en        VARCHAR(120) NOT NULL,
  value_ar        VARCHAR(120) NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_vtv_type FOREIGN KEY (variant_type_id) REFERENCES variant_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
