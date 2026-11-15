ALTER TABLE token_packages
  ADD COLUMN features_json JSON NULL,
  ADD COLUMN validity_days INT UNSIGNED NULL,
  ADD COLUMN compare_price_minor INT UNSIGNED NULL,
  ADD COLUMN promotion_starts_at DATETIME NULL,
  ADD COLUMN promotion_ends_at DATETIME NULL,
  ADD COLUMN promotion_motion VARCHAR(12) NOT NULL DEFAULT 'none';

ALTER TABLE ai_usage_reservations ADD COLUMN operation VARCHAR(20) NOT NULL DEFAULT 'refine';

CREATE TABLE IF NOT EXISTS ai_token_activity (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  request_key CHAR(64) NOT NULL UNIQUE,
  operation VARCHAR(20) NOT NULL,
  base_tokens INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_base_activity (user_id,id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_grants (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  package_id INT NULL,
  package_name VARCHAR(80) NOT NULL,
  expires_at DATETIME NULL,
  request_key VARCHAR(80) NOT NULL UNIQUE,
  reason VARCHAR(300) NOT NULL,
  granted_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_package_owner (user_id,expires_at,id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES token_packages(id) ON DELETE SET NULL,
  FOREIGN KEY (granted_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_entitlements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  grant_id BIGINT NOT NULL,
  feature_key VARCHAR(50) NOT NULL,
  included_uses INT UNSIGNED NULL,
  UNIQUE KEY idx_grant_feature (grant_id,feature_key),
  FOREIGN KEY (grant_id) REFERENCES package_grants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_use_reservations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entitlement_id BIGINT NOT NULL,
  reservation_key CHAR(32) NOT NULL UNIQUE,
  state VARCHAR(12) NOT NULL DEFAULT 'held',
  reserved_until DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_package_use (entitlement_id,state,reserved_until),
  FOREIGN KEY (entitlement_id) REFERENCES package_entitlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve delegated access when merging the two commercial modules.
INSERT IGNORE INTO admin_permissions (admin_id,module)
SELECT admin_id,REPLACE(module,'store.','pricing.') FROM admin_permissions WHERE module IN ('store.view','store.manage');
DELETE FROM admin_permissions WHERE module IN ('store.view','store.manage');

-- Move existing AI operation prices into the single feature pricing catalogue.
INSERT IGNORE INTO feature_prices (feature_key,mode,token_cost)
SELECT mapping.feature_key,IF(COALESCE(CAST(s.setting_value AS UNSIGNED),1)=0,'free','per_use'),COALESCE(CAST(s.setting_value AS UNSIGNED),1)
FROM (SELECT 'ai_assist' AS feature_key,'ai_cost_assist' AS setting_key
UNION ALL SELECT 'ai_refine','ai_cost_refine'
UNION ALL SELECT 'ai_cover_letter','ai_cost_cover_letter'
UNION ALL SELECT 'ai_review','ai_cost_review') mapping
LEFT JOIN app_settings s ON s.setting_key=mapping.setting_key;
