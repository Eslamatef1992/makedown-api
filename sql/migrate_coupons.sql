-- Discount coupons for the ecommerce checkout, plus the delivery-fee site
-- setting the cart/checkout order summary now shows for real (both were
-- previously fake: "Discount: 0%" and "Delivery Fees: 0.00" always,
-- regardless of what the customer entered or where they're shipping to).

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

ALTER TABLE orders
  ADD COLUMN coupon_id BIGINT UNSIGNED NULL AFTER grand_total,
  ADD COLUMN coupon_code VARCHAR(50) NULL AFTER coupon_id,
  ADD CONSTRAINT fk_order_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL;

-- The delivery fee itself lives in the existing generic site_settings
-- key/value table (see site-settings.repository.js) under the key
-- 'order_delivery_fee' — no schema change needed for it, it's just read
-- with a 0 default until an admin sets it from the admin panel.
