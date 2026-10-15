CREATE TABLE IF NOT EXISTS sales_channels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  store_id INT NOT NULL DEFAULT 1,
  name VARCHAR(100) NOT NULL,
  type ENUM('shopify','whatsapp','instagram','offline','distributor','other') NOT NULL DEFAULT 'other',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  fee_type ENUM('percentage','fixed','none') NOT NULL DEFAULT 'none',
  fee_value DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  config JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_store_id (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
