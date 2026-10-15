CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  store_id INT NOT NULL DEFAULT 1,
  channel_id INT NOT NULL,
  order_number VARCHAR(100) NOT NULL,
  shopify_order_id VARCHAR(100) NULL,
  shopify_order_number VARCHAR(100) NULL,
  customer_name VARCHAR(255) NULL,
  customer_contact VARCHAR(255) NULL,
  order_date DATE NOT NULL,
  status ENUM('draft','confirmed','fulfilled','cancelled','refunded') NOT NULL DEFAULT 'draft',
  payment_status ENUM('pending','paid','partial','refunded','na') NOT NULL DEFAULT 'pending',
  shipping_charged DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  actual_shipping_expense DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  discount_total DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  gross_sales DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  net_sales DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  contribution DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  contribution_margin_pct DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  notes TEXT NULL,
  shopify_sync_status ENUM('not_applicable','pending','synced','failed') NOT NULL DEFAULT 'not_applicable',
  shopify_synced_at DATETIME NULL,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shopify_order_id (shopify_order_id),
  FOREIGN KEY (channel_id) REFERENCES sales_channels(id),
  INDEX idx_order_number (order_number),
  INDEX idx_order_date (order_date),
  INDEX idx_channel_id (channel_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  variant_id INT NOT NULL,
  quantity INT NOT NULL,
  selling_price DECIMAL(15,4) NOT NULL,
  discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  net_product_sales DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  manufacturing_cost_snapshot DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  packaging_cost_snapshot DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  other_cost_snapshot DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  line_contribution DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  shopify_line_item_id VARCHAR(100) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  INDEX idx_order_id (order_id),
  INDEX idx_variant_id (variant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_costs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  cost_type ENUM('payment_gateway_fee','marketplace_fee','channel_fee','other') NOT NULL,
  amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  notes VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refunds (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  shopify_refund_id VARCHAR(100) NULL,
  refund_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  restock TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shopify_refund_id (shopify_refund_id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
