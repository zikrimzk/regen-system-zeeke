-- OpenAI migration: one atomic 15-request rolling window per authenticated user.
CREATE TABLE IF NOT EXISTS ai_usage_windows (
  user_id           INT PRIMARY KEY,
  window_started_at BIGINT UNSIGNED NOT NULL,
  request_count     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ai_usage_windows_started (window_started_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
