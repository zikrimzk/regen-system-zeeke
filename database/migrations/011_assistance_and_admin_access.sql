-- Apply once after 010. Existing pending reservations retain their previous accounting.
ALTER TABLE ai_usage_reservations
  ADD COLUMN token_cost SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN is_hold TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE admins ADD COLUMN is_bootstrap TINYINT(1) NOT NULL DEFAULT 0;

-- Temporary shared access. A registered admin can turn this off in System settings.
INSERT INTO admins (first_name, last_name, email, password_hash, role, status, must_change_password, is_bootstrap)
VALUES ('Temporary', 'Administrator', 'admin@regen.com', '$2y$10$xwqujLYFQsvfeopM1iklhuIXEHMxBurP5wsyhtYH9F9y0vNlSQssS', 'super_admin', 'active', 0, 1)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role),
  status = VALUES(status), must_change_password = 0, is_bootstrap = 1;
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('ai_cost_assist', '1'), ('ai_cost_refine', '1'), ('ai_cost_cover_letter', '1'), ('ai_cost_review', '1'),
  ('bootstrap_admin_enabled', '1')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);
