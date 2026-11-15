ALTER TABLE token_packages
  ADD COLUMN card_layout VARCHAR(12) NOT NULL DEFAULT 'hero',
  ADD COLUMN coin_color VARCHAR(12) NOT NULL DEFAULT 'emerald';

-- Carry the previous presentation choice into each existing package once.
UPDATE token_packages SET card_layout=CASE WHEN
  (SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.displayMode')) FROM operations_settings WHERE setting_key='token_store')='simple'
  THEN 'row' ELSE 'hero' END;

ALTER TABLE package_grants
  ADD COLUMN revoked_at DATETIME NULL,
  ADD COLUMN revoked_by INT NULL,
  ADD COLUMN revocation_reason VARCHAR(300) NULL,
  ADD COLUMN credited_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN reversed_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN version INT NOT NULL DEFAULT 1;

UPDATE package_grants g SET credited_tokens=COALESCE(
  (SELECT SUM(l.amount) FROM ai_bonus_ledger l WHERE l.request_key=CONCAT('package-grant:',g.id) AND l.source='package_grant'),0);

ALTER TABLE package_entitlements ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS package_grant_operations (
  request_key VARCHAR(64) PRIMARY KEY,
  user_id INT NULL,
  grant_id BIGINT NULL,
  result_grant_id BIGINT NULL,
  action VARCHAR(12) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  admin_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (grant_id) REFERENCES package_grants(id) ON DELETE SET NULL,
  FOREIGN KEY (result_grant_id) REFERENCES package_grants(id) ON DELETE SET NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
