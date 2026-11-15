-- Operational controls and privacy-safe email delivery history.

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('app_name', 'ReGen'),
  ('support_email', ''),
  ('registration_enabled', '1'),
  ('google_login_enabled', '1'),
  ('maintenance_mode', '0'),
  ('maintenance_message', 'ReGen is undergoing scheduled maintenance. Please try again shortly.'),
  ('user_self_delete_enabled', '1'),
  ('profile_email_change_enabled', '1'),
  ('max_active_sessions', '5'),
  ('audit_retention_days', '180')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  purpose        VARCHAR(50) NOT NULL,
  recipient_hash CHAR(64) NOT NULL,
  recipient_mask VARCHAR(220) NOT NULL,
  transport      VARCHAR(20) NOT NULL,
  status         VARCHAR(20) NOT NULL,
  request_id     VARCHAR(40) NULL,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_email_delivery_created (created_at),
  INDEX idx_email_delivery_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
