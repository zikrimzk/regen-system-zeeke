ALTER TABLE token_packages
  ADD COLUMN landing_visible TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN claim_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN claim_starts_at DATETIME NULL,
  ADD COLUMN claim_ends_at DATETIME NULL,
  ADD COLUMN claim_limit INT UNSIGNED NULL;

CREATE TABLE IF NOT EXISTS package_claims (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  user_id INT NULL,
  grant_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_package_claim_owner (package_id,user_id),
  UNIQUE KEY idx_package_claim_grant (grant_id),
  FOREIGN KEY (package_id) REFERENCES token_packages(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (grant_id) REFERENCES package_grants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
