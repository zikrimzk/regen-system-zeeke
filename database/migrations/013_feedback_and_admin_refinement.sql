-- Apply once after 012. Application timestamps use UTC.
ALTER TABLE ai_usage_reservations ADD COLUMN bonus_cost SMALLINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE notification_preferences
  MODIFY account_email TINYINT(1) NOT NULL DEFAULT 0,
  MODIFY support_email TINYINT(1) NOT NULL DEFAULT 0,
  MODIFY announcement_email TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN security_email TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN in_app_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN browser_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN consent_updated_at DATETIME NULL;
-- Previous defaults do not establish explicit consent for the new alert policy.
UPDATE notification_preferences SET account_email=0,support_email=0,announcement_email=0 WHERE consent_updated_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_bonus_wallets (
  user_id INT PRIMARY KEY,
  balance INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS ai_bonus_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount INT NOT NULL,
  balance_after INT UNSIGNED NOT NULL,
  reason VARCHAR(300) NOT NULL,
  source VARCHAR(30) NOT NULL,
  request_key VARCHAR(100) NOT NULL UNIQUE,
  admin_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bonus_user (user_id,id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS user_feedback (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  functionality_rating TINYINT UNSIGNED NULL,
  ease_rating TINYINT UNSIGNED NULL,
  area VARCHAR(40) NOT NULL,
  source VARCHAR(30) NOT NULL,
  comment TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  admin_note TEXT NULL,
  version INT NOT NULL DEFAULT 1,
  submission_key CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_feedback_submission (user_id,submission_key),
  INDEX idx_feedback_report (created_at,rating),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS feedback_rewards (
  user_id INT PRIMARY KEY,
  feedback_id BIGINT NOT NULL,
  amount SMALLINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (feedback_id) REFERENCES user_feedback(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS feedback_reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  feedback_id BIGINT NOT NULL,
  admin_id INT NULL,
  status VARCHAR(20) NOT NULL,
  note TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_review (feedback_id,id),
  FOREIGN KEY (feedback_id) REFERENCES user_feedback(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS admin_access_assignments (
  admin_id INT PRIMARY KEY,
  purpose VARCHAR(300) NOT NULL,
  expires_at DATETIME NULL,
  version INT NOT NULL DEFAULT 1,
  assigned_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO admin_permissions (admin_id,module)
 SELECT admin_id,CONCAT(module,'.view') FROM (SELECT admin_id,module FROM admin_permissions WHERE module NOT LIKE '%.%') existing_access;
INSERT IGNORE INTO admin_permissions (admin_id,module)
 SELECT admin_id,CONCAT(module,'.manage') FROM (SELECT admin_id,module FROM admin_permissions WHERE module NOT LIKE '%.%') existing_access;
DELETE FROM admin_permissions WHERE module NOT LIKE '%.%';

CREATE TABLE IF NOT EXISTS admin_notification_preferences (
  admin_id INT PRIMARY KEY,
  email_enabled TINYINT(1) NOT NULL DEFAULT 0,
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 0,
  browser_enabled TINYINT(1) NOT NULL DEFAULT 0,
  security_alerts TINYINT(1) NOT NULL DEFAULT 1,
  support_alerts TINYINT(1) NOT NULL DEFAULT 1,
  feedback_alerts TINYINT(1) NOT NULL DEFAULT 1,
  operations_alerts TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS admin_notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  module VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  dedupe_key VARCHAR(120) NOT NULL UNIQUE,
  read_at DATETIME NULL,
  email_status VARCHAR(20) NOT NULL DEFAULT 'none',
  attempts SMALLINT NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_alert_owner (admin_id,id),
  INDEX idx_admin_alert_mail (email_status,available_at),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS security_incidents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  incident_key VARCHAR(120) NOT NULL UNIQUE,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(180) NOT NULL,
  details VARCHAR(1000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  resolution_note VARCHAR(1000) NULL,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
