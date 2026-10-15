-- Phase 1 MVP Unit-Economics Migration
-- Adding Master Settings, Channel Economics, Product Bar Divisor, Order Snapshots, and Expenses Table

-- 1. Master Settings on Stores
ALTER TABLE stores
  ADD COLUMN tax_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN tax_registered TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN global_reorder_threshold INT NOT NULL DEFAULT 10,
  ADD COLUMN shared_unit_costs JSON NULL;

-- 2. Channel Master Data
ALTER TABLE sales_channels
  ADD COLUMN units_per_sale INT NOT NULL DEFAULT 1,
  ADD COLUMN price_includes_tax TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN commission_pct DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN gateway_pct DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN shipping_per_sale DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN other_variable_cost DECIMAL(10,4) NOT NULL DEFAULT 0.0000;

-- 3. Product & Variant Master Data (bars per sale)
ALTER TABLE products
  ADD COLUMN units_per_sale INT NOT NULL DEFAULT 1;

ALTER TABLE product_variants
  ADD COLUMN units_per_sale INT NOT NULL DEFAULT 1;

-- 4. Order Level Economics Totals
ALTER TABLE orders
  ADD COLUMN tax_total DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN net_revenue DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN channel_cost_total DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN cogs_total DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN bars_total INT NOT NULL DEFAULT 0;

-- 5. Order Items Snapshots & Economics (Formulas 1-10)
ALTER TABLE order_items
  ADD COLUMN bars_sold INT NOT NULL DEFAULT 1,
  ADD COLUMN sale_count DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
  ADD COLUMN landed_cost_snapshot DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN shared_cost_snapshot DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN tax_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN net_revenue DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN channel_cost DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN cogs DECIMAL(15,4) NOT NULL DEFAULT 0.0000;

-- 6. Expenses / Overheads Table (Formulas 14 & 15)
CREATE TABLE IF NOT EXISTS expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  store_id INT NOT NULL DEFAULT 1,
  expense_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  is_cogs TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_expense_date (expense_date),
  INDEX idx_category (category),
  INDEX idx_is_cogs (is_cogs),
  INDEX idx_store_id (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
