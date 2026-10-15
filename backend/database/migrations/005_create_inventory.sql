CREATE TABLE IF NOT EXISTS inventory_locations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  store_id INT NOT NULL DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  shopify_location_id VARCHAR(100) NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_balances (
  id INT PRIMARY KEY AUTO_INCREMENT,
  variant_id INT NOT NULL,
  location_id INT NOT NULL,
  available_qty INT NOT NULL DEFAULT 0,
  reserved_qty INT NOT NULL DEFAULT 0,
  incoming_qty INT NOT NULL DEFAULT 0,
  shopify_available INT NULL,
  last_synced_at DATETIME NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_variant_location (variant_id, location_id),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES inventory_locations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  variant_id INT NOT NULL,
  location_id INT NOT NULL,
  qty_change INT NOT NULL,
  qty_before INT NOT NULL,
  qty_after INT NOT NULL,
  movement_type ENUM('sale','return','adjustment','import','shopify_sync','restock','initial') NOT NULL,
  reference_type ENUM('order','refund','adjustment','webhook','import','manual') NULL,
  reference_id INT NULL,
  source_system ENUM('manual','shopify','system') NOT NULL DEFAULT 'manual',
  shopify_reference VARCHAR(255) NULL,
  sync_status ENUM('synced','pending','failed','na') NOT NULL DEFAULT 'na',
  user_id INT NULL,
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  INDEX idx_variant_id (variant_id),
  INDEX idx_created_at (created_at),
  INDEX idx_movement_type (movement_type),
  INDEX idx_reference (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
