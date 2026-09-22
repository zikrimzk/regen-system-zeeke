-- Idempotent AI request reservations prevent duplicate failure refunds.
CREATE TABLE IF NOT EXISTS ai_usage_reservations (
  reservation_token CHAR(64) PRIMARY KEY,
  user_id            INT NOT NULL,
  window_started_at  BIGINT UNSIGNED NOT NULL,
  expires_at         BIGINT UNSIGNED NOT NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_usage_reservations_user (user_id),
  INDEX idx_ai_usage_reservations_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
