ALTER TABLE token_packages ADD COLUMN template_tiers JSON NULL;
ALTER TABLE package_entitlements ADD COLUMN template_tiers JSON NULL;

CREATE TABLE IF NOT EXISTS package_template_unlocks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entitlement_id BIGINT NOT NULL,
  template_id VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_package_template (entitlement_id,template_id),
  FOREIGN KEY (entitlement_id) REFERENCES package_entitlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve paid gallery unlocks; package limits become the default for new selections.
INSERT INTO feature_prices (feature_key,mode,token_cost) VALUES ('templates','package_only',0)
ON DUPLICATE KEY UPDATE mode=IF(mode='free','package_only',mode),token_cost=IF(mode='package_only',0,token_cost),version=version+1;

CREATE TABLE IF NOT EXISTS user_template_library (
  user_id INT NOT NULL,
  template_id VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id,template_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A saved design from before this upgrade remains reusable.
INSERT IGNORE INTO user_template_library (user_id,template_id)
SELECT user_id,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(resume_data,'$.templateId')),'classic') FROM resumes;
