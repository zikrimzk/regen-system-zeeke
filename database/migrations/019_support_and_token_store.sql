CREATE TABLE IF NOT EXISTS support_attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  storage_key CHAR(64) NOT NULL UNIQUE,
  filename VARCHAR(180) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attachment_message (message_id,id),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES support_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS token_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  tokens INT UNSIGNED NOT NULL,
  bonus_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  price_minor INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'MYR',
  badge VARCHAR(30) NOT NULL DEFAULT '',
  highlighted TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 10,
  version INT NOT NULL DEFAULT 1,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_package_catalogue (active,sort_order,id),
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feature_prices (
  feature_key VARCHAR(50) PRIMARY KEY,
  mode VARCHAR(20) NOT NULL DEFAULT 'free',
  token_cost INT UNSIGNED NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS token_access_purchases (
  request_key VARCHAR(80) PRIMARY KEY,
  user_id INT NOT NULL,
  feature_key VARCHAR(50) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  token_cost INT UNSIGNED NOT NULL,
  price_version INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_feature_entitlements (
  user_id INT NOT NULL,
  feature_key VARCHAR(50) NOT NULL,
  paid_tokens INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id,feature_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feature_use_credits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  feature_key VARCHAR(50) NOT NULL,
  paid_tokens INT UNSIGNED NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'available',
  reservation_key CHAR(32) NULL,
  reserved_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME NULL,
  INDEX idx_feature_credit (user_id,feature_key,state,id),
  INDEX idx_user_credit_history (user_id,state,id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
