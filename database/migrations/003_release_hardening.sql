-- ReGen release hardening: shared rate limits for multi-process deployments.
CREATE TABLE IF NOT EXISTS app_rate_limits (
  bucket_key        CHAR(64)     PRIMARY KEY,
  bucket_name       VARCHAR(80)  NOT NULL,
  window_started_at BIGINT UNSIGNED NOT NULL,
  request_count     INT UNSIGNED NOT NULL,
  expires_at        BIGINT UNSIGNED NOT NULL,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_app_rate_limits_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
