-- Apply once after 015. Existing AI allowances continue renewing by default.
INSERT IGNORE INTO app_settings (setting_key,setting_value) VALUES ('ai_renewable','1');
CREATE TABLE IF NOT EXISTS campaigns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT 'emerald',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  audience VARCHAR(20) NOT NULL DEFAULT 'all',
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  reward_enabled TINYINT(1) NOT NULL DEFAULT 0,
  reward_amount SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  reward_limit SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  total_claim_limit INT UNSIGNED NOT NULL DEFAULT 0,
  claim_count INT UNSIGNED NOT NULL DEFAULT 0,
  delivery_cursor INT NOT NULL DEFAULT 0,
  max_user_id INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_by INT NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_campaign_delivery (status,starts_at,ends_at),
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS campaign_claims (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  sequence_number SMALLINT UNSIGNED NOT NULL,
  amount SMALLINT UNSIGNED NOT NULL,
  request_key CHAR(36) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_campaign_user_sequence (campaign_id,user_id,sequence_number),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS campaign_receipts (
  campaign_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  dismissed_at DATETIME NULL,
  PRIMARY KEY (campaign_id,user_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
