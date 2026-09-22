-- ReGen email verification migration.
-- Run once against an existing database before deploying email verification.

ALTER TABLE users
  ADD COLUMN email_verified_at DATETIME(3) NULL
    DEFAULT CURRENT_TIMESTAMP(3) AFTER address;

-- The temporary default backfills only rows that exist while this run-once
-- migration adds the column. Remove it immediately so all future password
-- registrations start unverified. Rerunning this migration intentionally fails
-- at ADD COLUMN instead of silently verifying pending accounts.
ALTER TABLE users
  MODIFY COLUMN email_verified_at DATETIME(3) NULL DEFAULT NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  user_id        INT          PRIMARY KEY,
  token_hash     BINARY(32)   NOT NULL,
  email_at_issue VARCHAR(200) NOT NULL,
  expires_at     DATETIME(3)  NOT NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_email_verification_token_hash (token_hash),
  INDEX idx_email_verification_expires (expires_at),
  CONSTRAINT fk_email_verification_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
