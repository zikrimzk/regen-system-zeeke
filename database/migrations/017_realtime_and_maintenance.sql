-- Durable application events: the outbox is written with domain transactions.
-- A serialized dispatcher assigns replay IDs only after those transactions commit.
CREATE TABLE IF NOT EXISTS realtime_connections (
  lease_id CHAR(32) NOT NULL PRIMARY KEY,
  session_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  KEY idx_realtime_connections (session_hash,expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS realtime_outbox (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  topic VARCHAR(32) NOT NULL,
  audience VARCHAR(16) NOT NULL,
  recipient_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  resource_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS realtime_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  topic VARCHAR(32) NOT NULL,
  audience VARCHAR(16) NOT NULL,
  recipient_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  resource_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_realtime_recipient (audience,recipient_id,id),
  KEY idx_realtime_retention (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS maintenance_controls (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  mode VARCHAR(16) NOT NULL DEFAULT 'off',
  title VARCHAR(120) NOT NULL DEFAULT 'A little time to make things better.',
  message VARCHAR(2000) NOT NULL DEFAULT 'We are taking care of ReGen. Your saved work will be here when we return.',
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  estimated_at DATETIME NULL,
  version INT UNSIGNED NOT NULL DEFAULT 0,
  updated_by INT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO maintenance_controls (id,mode,message)
SELECT 1,IF(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key='maintenance_mode'),'0')='1','immediate','off'),
 COALESCE((SELECT setting_value FROM app_settings WHERE setting_key='maintenance_message'),'We are taking care of ReGen. Your saved work will be here when we return.');
