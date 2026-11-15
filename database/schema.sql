-- ReGen powered by Zeeke - Database Schema
-- Run this against: zeekeresumedb

CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  email        VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  phone        VARCHAR(30)  DEFAULT '',
  address      VARCHAR(500) DEFAULT '',
  email_verified_at DATETIME(3) NULL,
  account_status VARCHAR(20) NOT NULL DEFAULT 'active',
  ai_token_limit SMALLINT UNSIGNED NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_status_created (account_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  user_id        INT          PRIMARY KEY,
  token_hash     BINARY(32)   NOT NULL,
  email_at_issue VARCHAR(200) NOT NULL,
  expires_at     DATETIME(3)  NOT NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_email_verification_token_hash (token_hash),
  INDEX idx_email_verification_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_identities (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT          NOT NULL,
  provider         VARCHAR(32)  NOT NULL,
  provider_subject VARCHAR(255) NOT NULL,
  email_at_link    VARCHAR(200) NOT NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_identities_provider_subject (provider, provider_subject),
  UNIQUE KEY uq_user_identities_user_provider (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resumes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  title        VARCHAR(200) NOT NULL DEFAULT 'Untitled Resume',
  resume_data  JSON,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_resumes_user_updated (user_id, updated_at, id),
  FOREIGN KEY  (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_sessions (
  sid          VARCHAR(128) PRIMARY KEY,
  session_data JSON         NOT NULL,
  expires_at   DATETIME(3)  NOT NULL,
  updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_app_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_rate_limits (
  bucket_key        CHAR(64)     PRIMARY KEY,
  bucket_name       VARCHAR(80)  NOT NULL,
  window_started_at BIGINT UNSIGNED NOT NULL,
  request_count     INT UNSIGNED NOT NULL,
  expires_at        BIGINT UNSIGNED NOT NULL,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_app_rate_limits_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_usage_windows (
  user_id           INT PRIMARY KEY,
  window_started_at BIGINT UNSIGNED NOT NULL,
  request_count     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ai_usage_windows_started (window_started_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_usage_reservations (
  operation VARCHAR(20) NOT NULL DEFAULT 'refine',
  reservation_token CHAR(64) PRIMARY KEY,
  token_cost SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  is_hold TINYINT(1) NOT NULL DEFAULT 0,
  user_id            INT NOT NULL,
  window_started_at  BIGINT UNSIGNED NOT NULL,
  expires_at         BIGINT UNSIGNED NOT NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_usage_reservations_user (user_id),
  INDEX idx_ai_usage_reservations_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'admin',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  is_bootstrap TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME(3) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admins_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Temporary shared access. A registered admin can turn this off in System settings.
INSERT INTO admins (first_name, last_name, email, password_hash, role, status, must_change_password, is_bootstrap)
VALUES ('Temporary', 'Administrator', 'admin@regen.com', '$2y$10$xwqujLYFQsvfeopM1iklhuIXEHMxBurP5wsyhtYH9F9y0vNlSQssS', 'super_admin', 'active', 0, 1)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role),
  status = VALUES(status), must_change_password = 0, is_bootstrap = 1;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('ai_enabled', '1'), ('ai_default_limit', '10'), ('ai_renewal_hours', '24'),
  ('app_name', 'ReGen'), ('support_email', ''), ('registration_enabled', '1'),
  ('google_login_enabled', '1'), ('maintenance_mode', '0'),
  ('maintenance_message', 'ReGen is undergoing scheduled maintenance. Please try again shortly.'),
  ('user_self_delete_enabled', '1'), ('profile_email_change_enabled', '1'),
  ('max_active_sessions', '5'), ('audit_retention_days', '180')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

CREATE TABLE IF NOT EXISTS account_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_hash CHAR(64) NOT NULL,
  device_label VARCHAR(160) NOT NULL,
  browser_label VARCHAR(120) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  last_seen_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  history_hidden_at DATETIME(3) NULL,
  UNIQUE KEY uq_account_sessions_hash (session_hash),
  INDEX idx_account_sessions_user_seen (user_id, last_seen_at),
  INDEX idx_account_sessions_history (user_id, history_hidden_at, last_seen_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_type VARCHAR(20) NOT NULL,
  actor_id INT NULL,
  event_type VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NULL,
  target_id VARCHAR(100) NULL,
  ip_hash CHAR(64) NOT NULL,
  user_agent VARCHAR(255) NOT NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_actor (actor_type, actor_id, created_at),
  INDEX idx_audit_event (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  purpose VARCHAR(50) NOT NULL,
  recipient_hash CHAR(64) NOT NULL,
  recipient_mask VARCHAR(220) NOT NULL,
  transport VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  request_id VARCHAR(40) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_email_delivery_created (created_at),
  INDEX idx_email_delivery_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Apply once before deploying the user workspace update.
CREATE TABLE IF NOT EXISTS cover_letters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  resume_id INT NOT NULL,
  company VARCHAR(200) NOT NULL,
  role VARCHAR(200) NOT NULL,
  recipient VARCHAR(200) NOT NULL DEFAULT '',
  company_details TEXT NOT NULL,
  job_description TEXT NOT NULL,
  body MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cover_letters_user (user_id, updated_at, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('ai_cost_assist', '1'), ('ai_cost_refine', '1'), ('ai_cost_cover_letter', '1'), ('ai_cost_review', '1'),
  ('bootstrap_admin_enabled', '1')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

-- Apply once after 011. All timestamps below are UTC.
CREATE TABLE IF NOT EXISTS document_generations (
  user_id INT PRIMARY KEY,
  generation INT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id INT PRIMARY KEY,
  token_hash BINARY(32) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_permissions (
  admin_id INT NOT NULL,
  module VARCHAR(40) NOT NULL,
  PRIMARY KEY (admin_id, module),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feature_controls (
  feature_key VARCHAR(50) PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  message VARCHAR(300) NOT NULL DEFAULT '',
  downtime_start DATETIME NULL,
  downtime_end DATETIME NULL,
  version INT NOT NULL DEFAULT 1,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operations_settings (
  setting_key VARCHAR(50) PRIMARY KEY,
  payload JSON NOT NULL,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subject VARCHAR(180) NOT NULL,
  category VARCHAR(30) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  assigned_admin_id INT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_support_queue (status, updated_at),
  INDEX idx_support_user (user_id, updated_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  author_type VARCHAR(20) NOT NULL,
  author_id INT NOT NULL,
  internal_note TINYINT(1) NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_support_messages (ticket_id, id),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category VARCHAR(30) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  link VARCHAR(200) NOT NULL DEFAULT '/notifications',
  dedupe_key VARCHAR(100) NULL UNIQUE,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INT PRIMARY KEY,
  account_email TINYINT(1) NOT NULL DEFAULT 1,
  support_email TINYINT(1) NOT NULL DEFAULT 1,
  announcement_email TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_outbox (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  notification_id BIGINT NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts SMALLINT NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_outbox_pending (status, available_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (notification_id) REFERENCES user_notifications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_campaigns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  audience VARCHAR(30) NOT NULL,
  send_email TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  last_user_id INT NOT NULL DEFAULT 0,
  max_user_id INT NOT NULL,
  recipient_count INT NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recovery_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(180) NOT NULL,
  payload JSON NOT NULL,
  created_by INT NULL,
  restored_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recovery_user (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS landing_daily (
  day DATE PRIMARY KEY,
  page_views INT UNSIGNED NOT NULL DEFAULT 0,
  visitors INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS landing_visitors (
  day DATE NOT NULL,
  visitor_hash CHAR(64) NOT NULL,
  PRIMARY KEY (day, visitor_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_blocks (
  identity_hash CHAR(64) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  reason VARCHAR(300) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Apply once after 012. Application timestamps use UTC.
ALTER TABLE ai_usage_reservations ADD COLUMN bonus_cost SMALLINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE notification_preferences
  MODIFY account_email TINYINT(1) NOT NULL DEFAULT 0,
  MODIFY support_email TINYINT(1) NOT NULL DEFAULT 0,
  MODIFY announcement_email TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN security_email TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN in_app_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN browser_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN consent_updated_at DATETIME NULL;
-- Previous defaults do not establish explicit consent for the new alert policy.
UPDATE notification_preferences SET account_email=0,support_email=0,announcement_email=0 WHERE consent_updated_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_bonus_wallets (
  user_id INT PRIMARY KEY,
  balance INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS ai_bonus_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount INT NOT NULL,
  balance_after INT UNSIGNED NOT NULL,
  reason VARCHAR(300) NOT NULL,
  source VARCHAR(30) NOT NULL,
  request_key VARCHAR(100) NOT NULL UNIQUE,
  admin_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bonus_user (user_id,id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS user_feedback (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  functionality_rating TINYINT UNSIGNED NULL,
  ease_rating TINYINT UNSIGNED NULL,
  area VARCHAR(40) NOT NULL,
  source VARCHAR(30) NOT NULL,
  comment TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  admin_note TEXT NULL,
  version INT NOT NULL DEFAULT 1,
  submission_key CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_feedback_submission (user_id,submission_key),
  INDEX idx_feedback_report (created_at,rating),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS feedback_rewards (
  user_id INT PRIMARY KEY,
  feedback_id BIGINT NOT NULL,
  amount SMALLINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (feedback_id) REFERENCES user_feedback(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS feedback_reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  feedback_id BIGINT NOT NULL,
  admin_id INT NULL,
  status VARCHAR(20) NOT NULL,
  note TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_review (feedback_id,id),
  FOREIGN KEY (feedback_id) REFERENCES user_feedback(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS admin_access_assignments (
  admin_id INT PRIMARY KEY,
  purpose VARCHAR(300) NOT NULL,
  expires_at DATETIME NULL,
  version INT NOT NULL DEFAULT 1,
  assigned_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO admin_permissions (admin_id,module)
 SELECT admin_id,CONCAT(module,'.view') FROM (SELECT admin_id,module FROM admin_permissions WHERE module NOT LIKE '%.%') existing_access;
INSERT IGNORE INTO admin_permissions (admin_id,module)
 SELECT admin_id,CONCAT(module,'.manage') FROM (SELECT admin_id,module FROM admin_permissions WHERE module NOT LIKE '%.%') existing_access;
DELETE FROM admin_permissions WHERE module NOT LIKE '%.%';

CREATE TABLE IF NOT EXISTS admin_notification_preferences (
  admin_id INT PRIMARY KEY,
  email_enabled TINYINT(1) NOT NULL DEFAULT 0,
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 0,
  browser_enabled TINYINT(1) NOT NULL DEFAULT 0,
  security_alerts TINYINT(1) NOT NULL DEFAULT 1,
  support_alerts TINYINT(1) NOT NULL DEFAULT 1,
  feedback_alerts TINYINT(1) NOT NULL DEFAULT 1,
  operations_alerts TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS admin_notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  module VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  dedupe_key VARCHAR(120) NOT NULL UNIQUE,
  read_at DATETIME NULL,
  email_status VARCHAR(20) NOT NULL DEFAULT 'none',
  attempts SMALLINT NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_alert_owner (admin_id,id),
  INDEX idx_admin_alert_mail (email_status,available_at),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS security_incidents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  incident_key VARCHAR(120) NOT NULL UNIQUE,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(180) NOT NULL,
  details VARCHAR(1000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  resolution_note VARCHAR(1000) NULL,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Apply once after 013. Visibility affects new selections; saved documents keep rendering.
CREATE TABLE IF NOT EXISTS template_controls (
  template_id VARCHAR(30) PRIMARY KEY,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  popular TINYINT(1) NOT NULL DEFAULT 0,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO template_controls (template_id,sort_order) VALUES
 ('classic',10),('modern',20),('minimal',30),('heritage',40),('essential',50),('graduate',60),
 ('executive',70),('editorial',80),('precision',90),('horizon',100),('signature',110),('atlas',120),
 ('meridian',130),('keystone',140),('counsel',150),('impact',160);
CREATE TABLE IF NOT EXISTS template_selection_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  template_id VARCHAR(30) NOT NULL,
  user_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_template_selection (template_id,user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO template_selection_events (template_id,user_id)
 SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.resume_data,'$.templateId')),'classic'),r.user_id
 FROM resumes r WHERE NOT EXISTS (
   SELECT 1 FROM resumes newer WHERE newer.user_id=r.user_id AND
   (newer.updated_at>r.updated_at OR (newer.updated_at=r.updated_at AND newer.id>r.id))
 );

-- Apply once after 014. Existing rewarded feedback remains counted toward the default limit of one.
ALTER TABLE feedback_rewards DROP PRIMARY KEY, ADD PRIMARY KEY (user_id,feedback_id);
ALTER TABLE support_tickets ADD COLUMN client_context JSON NULL;
-- Apply once after 015. Existing AI allowances continue renewing by default.
INSERT IGNORE INTO app_settings (setting_key,setting_value) VALUES ('ai_renewable','1');
CREATE TABLE IF NOT EXISTS campaigns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT 'emerald',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  audience VARCHAR(20) NOT NULL DEFAULT 'all',
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  reward_enabled TINYINT(1) NOT NULL DEFAULT 0,
  reward_amount SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  reward_limit SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  total_claim_limit INT UNSIGNED NOT NULL DEFAULT 0,
  claim_count INT UNSIGNED NOT NULL DEFAULT 0,
  delivery_cursor INT NOT NULL DEFAULT 0,
  max_user_id INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_by INT NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_campaign_delivery (status,starts_at,ends_at),
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS campaign_claims (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  sequence_number SMALLINT UNSIGNED NOT NULL,
  amount SMALLINT UNSIGNED NOT NULL,
  request_key CHAR(36) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_campaign_user_sequence (campaign_id,user_id,sequence_number),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS campaign_receipts (
  campaign_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  dismissed_at DATETIME NULL,
  PRIMARY KEY (campaign_id,user_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
CREATE TABLE IF NOT EXISTS support_attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  storage_key CHAR(64) NOT NULL UNIQUE,
  filename VARCHAR(180) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attachment_message (message_id,id),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES support_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS token_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  tokens INT UNSIGNED NOT NULL,
  bonus_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  price_minor INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'MYR',
  badge VARCHAR(30) NOT NULL DEFAULT '',
  highlighted TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 10,
  template_tiers JSON NULL,
  landing_visible TINYINT(1) NOT NULL DEFAULT 1,
  claim_enabled TINYINT(1) NOT NULL DEFAULT 0,
  claim_starts_at DATETIME NULL,
  claim_ends_at DATETIME NULL,
  claim_limit INT UNSIGNED NULL,
  card_layout VARCHAR(12) NOT NULL DEFAULT 'hero',
  coin_color VARCHAR(12) NOT NULL DEFAULT 'emerald',
  features_json JSON NULL,
  validity_days INT UNSIGNED NULL,
  compare_price_minor INT UNSIGNED NULL,
  promotion_starts_at DATETIME NULL,
  promotion_ends_at DATETIME NULL,
  promotion_motion VARCHAR(12) NOT NULL DEFAULT 'none',
  version INT NOT NULL DEFAULT 1,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_package_catalogue (active,sort_order,id),
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feature_prices (
  feature_key VARCHAR(50) PRIMARY KEY,
  mode VARCHAR(20) NOT NULL DEFAULT 'package_only',
  token_cost INT UNSIGNED NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS token_access_purchases (
  request_key VARCHAR(80) PRIMARY KEY,
  user_id INT NOT NULL,
  feature_key VARCHAR(50) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  token_cost INT UNSIGNED NOT NULL,
  price_version INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_feature_entitlements (
  user_id INT NOT NULL,
  feature_key VARCHAR(50) NOT NULL,
  paid_tokens INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id,feature_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feature_use_credits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  feature_key VARCHAR(50) NOT NULL,
  paid_tokens INT UNSIGNED NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'available',
  reservation_key CHAR(32) NULL,
  reserved_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME NULL,
  INDEX idx_feature_credit (user_id,feature_key,state,id),
  INDEX idx_user_credit_history (user_id,state,id),
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
  revoked_at DATETIME NULL,
  revoked_by INT NULL,
  revocation_reason VARCHAR(300) NULL,
  credited_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  reversed_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
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
  template_tiers JSON NULL,
  included_uses INT UNSIGNED NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
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


-- Move existing AI operation prices into the single feature pricing catalogue.
INSERT IGNORE INTO feature_prices (feature_key,mode,token_cost)
SELECT mapping.feature_key,IF(COALESCE(CAST(s.setting_value AS UNSIGNED),1)=0,'free','per_use'),COALESCE(CAST(s.setting_value AS UNSIGNED),1)
FROM (SELECT 'ai_assist' AS feature_key,'ai_cost_assist' AS setting_key
UNION ALL SELECT 'ai_refine','ai_cost_refine'
UNION ALL SELECT 'ai_cover_letter','ai_cost_cover_letter'
UNION ALL SELECT 'ai_review','ai_cost_review') mapping
LEFT JOIN app_settings s ON s.setting_key=mapping.setting_key;

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

-- Preserve earlier rules for administrator review. This is a one-time access-policy change.
INSERT IGNORE INTO operations_settings (setting_key,payload)
SELECT 'strict_package_upgrade_024',JSON_OBJECT('previousRules',COALESCE(JSON_ARRAYAGG(JSON_OBJECT('feature',feature_key,'mode',mode,'cost',token_cost)),JSON_ARRAY())) FROM feature_prices;

ALTER TABLE feature_prices ALTER COLUMN mode SET DEFAULT 'package_only';
INSERT IGNORE INTO feature_prices (feature_key) VALUES
('resume_create'),('resume_editor'),('templates'),('cover_letters'),('cover_letter_create'),
('ai_assist'),('ai_refine'),('ai_review'),('ai_cover_letter'),('mochi_coach'),('pdf_download'),
('document_preview'),('photo_upload'),('resume_rename'),('document_settings');
UPDATE feature_prices SET mode='package_only',version=version+1;

CREATE TABLE IF NOT EXISTS mochi_profiles (
    user_id INT NOT NULL PRIMARY KEY,
    preferences JSON NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mochi_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE cover_letters ADD COLUMN recipient_address VARCHAR(1000) NOT NULL DEFAULT '', ADD COLUMN letter_date DATE NULL;
UPDATE cover_letters SET letter_date=DATE(created_at) WHERE letter_date IS NULL;
ALTER TABLE user_notifications ADD COLUMN removed_at DATETIME NULL;
ALTER TABLE admin_notifications ADD COLUMN removed_at DATETIME NULL;
ALTER TABLE token_packages
  ADD COLUMN offer_headline VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN offer_cta VARCHAR(40) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS payment_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  reference CHAR(35) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  user_id INT NULL,
  package_id INT NULL,
  package_version INT NOT NULL,
  package_name VARCHAR(80) NOT NULL,
  benefits_json JSON NOT NULL,
  amount_minor INT UNSIGNED NOT NULL,
  currency CHAR(3) CHARACTER SET ascii NOT NULL,
  gateway_mode ENUM('sandbox','live') NOT NULL,
  request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  state ENUM('creating','pending','unavailable','failed','paid') NOT NULL DEFAULT 'creating',
  gateway_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  gateway_charge_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  checkout_url VARCHAR(1024) NULL,
  link_expires_at DATETIME NOT NULL,
  grant_id BIGINT NULL,
  refunded_minor INT UNSIGNED NOT NULL DEFAULT 0,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_checkout_attempt (user_id, request_key),
  UNIQUE KEY unique_hitpay_request (gateway_mode, gateway_request_id),
  UNIQUE KEY unique_hitpay_charge (gateway_mode, gateway_charge_id),
  KEY payment_history (user_id, id),
  KEY resumable_checkout (user_id, package_id, gateway_mode, state, link_expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (package_id) REFERENCES token_packages(id) ON DELETE SET NULL,
  FOREIGN KEY (grant_id) REFERENCES package_grants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
