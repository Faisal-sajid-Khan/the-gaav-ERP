CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  store_id INT NOT NULL DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NULL,
  description TEXT NULL,
  shopify_product_id VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sku (sku),
  INDEX idx_shopify_product_id (shopify_product_id),
  INDEX idx_store_id (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_variants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT 'Default',
  sku VARCHAR(100) NULL,
  shopify_variant_id VARCHAR(100) NULL,
  shopify_inventory_item_id VARCHAR(100) NULL,
  selling_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  manufacturing_cost DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  packaging_cost DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  other_cost DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  reorder_threshold INT NOT NULL DEFAULT 10,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shopify_variant_id (shopify_variant_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_id (product_id),
  INDEX idx_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_cost_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  variant_id INT NOT NULL,
  manufacturing_cost DECIMAL(15,4) NOT NULL,
  packaging_cost DECIMAL(15,4) NOT NULL,
  other_cost DECIMAL(15,4) NOT NULL,
  effective_from DATETIME NOT NULL,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  INDEX idx_variant_effective (variant_id, effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
