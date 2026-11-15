ALTER TABLE user_notifications ADD COLUMN removed_at DATETIME NULL;
ALTER TABLE admin_notifications ADD COLUMN removed_at DATETIME NULL;
ALTER TABLE token_packages
  ADD COLUMN offer_headline VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN offer_cta VARCHAR(40) NOT NULL DEFAULT '';
