-- One durable provider checkpoint, independent of browser replay cursors.
CREATE TABLE IF NOT EXISTS realtime_delivery_state (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  delivered_cursor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  failures INT UNSIGNED NOT NULL DEFAULT 0,
  retry_at DATETIME NULL,
  last_success_at DATETIME NULL,
  last_error VARCHAR(80) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO realtime_delivery_state (id) VALUES (1);
