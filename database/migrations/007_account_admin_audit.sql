-- ReGen phase-one account, admin, audit and AI-control foundation.
-- Apply once after migration 006 on an existing database.

ALTER TABLE users
  ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER email_verified_at,
  ADD COLUMN ai_token_limit SMALLINT UNSIGNED NULL AFTER account_status,
  ADD INDEX idx_users_status_created (account_status, created_at);

CREATE TABLE IF NOT EXISTS admins (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  first_name           VARCHAR(100) NOT NULL,
  last_name            VARCHAR(100) NOT NULL,
  email                VARCHAR(200) NOT NULL UNIQUE,
  password_hash        VARCHAR(255) NOT NULL,
  role                 VARCHAR(30) NOT NULL DEFAULT 'admin',
  status               VARCHAR(20) NOT NULL DEFAULT 'active',
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at        DATETIME(3) NULL,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admins_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bootstrap credential requested for first deployment. Change it immediately
-- after first login; the UI keeps a visible warning until it is changed.
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(80) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL,
  updated_by    INT NULL,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('ai_enabled', '1'),
  ('ai_default_limit', '10'),
  ('ai_renewal_hours', '24')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

CREATE TABLE IF NOT EXISTS account_sessions (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  session_hash    CHAR(64) NOT NULL,
  device_label    VARCHAR(160) NOT NULL,
  browser_label   VARCHAR(120) NOT NULL,
  ip_hash         CHAR(64) NOT NULL,
  last_seen_at    DATETIME(3) NOT NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at      DATETIME(3) NULL,
  UNIQUE KEY uq_account_sessions_hash (session_hash),
  INDEX idx_account_sessions_user_seen (user_id, last_seen_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_type   VARCHAR(20) NOT NULL,
  actor_id     INT NULL,
  event_type   VARCHAR(100) NOT NULL,
  target_type  VARCHAR(50) NULL,
  target_id    VARCHAR(100) NULL,
  ip_hash      CHAR(64) NOT NULL,
  user_agent   VARCHAR(255) NOT NULL,
  metadata     JSON NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_actor (actor_type, actor_id, created_at),
  INDEX idx_audit_event (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
