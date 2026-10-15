CREATE TABLE IF NOT EXISTS shopify_webhook_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  store_id INT NOT NULL DEFAULT 1,
  topic VARCHAR(100) NOT NULL,
  shopify_event_id VARCHAR(255) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('received','processing','processed','failed','skipped') NOT NULL DEFAULT 'received',
  error_message TEXT NULL,
  processed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shopify_event_id (shopify_event_id),
  INDEX idx_topic (topic),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_jobs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  store_id INT NOT NULL DEFAULT 1,
  job_type VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50) NULL,
  reference_id INT NULL,
  payload JSON NULL,
  status ENUM('pending','running','done','failed','cancelled') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  next_retry_at DATETIME NULL,
  last_error TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_next_retry (next_retry_at),
  INDEX idx_job_type (job_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
