-- ReGen Google authentication migration
-- Run once against an existing ReGen database before deploying the Google sign-in code.

ALTER TABLE users
  MODIFY password_hash VARCHAR(255) NULL;

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
  CONSTRAINT fk_user_identities_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
