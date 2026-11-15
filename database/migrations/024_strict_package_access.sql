-- Preserve earlier rules for administrator review. This is a one-time access-policy change.
INSERT IGNORE INTO operations_settings (setting_key,payload)
SELECT 'strict_package_upgrade_024',JSON_OBJECT('previousRules',COALESCE(JSON_ARRAYAGG(JSON_OBJECT('feature',feature_key,'mode',mode,'cost',token_cost)),JSON_ARRAY())) FROM feature_prices;

ALTER TABLE feature_prices ALTER COLUMN mode SET DEFAULT 'package_only';
INSERT IGNORE INTO feature_prices (feature_key) VALUES
('resume_create'),('resume_editor'),('templates'),('cover_letters'),('cover_letter_create'),
('ai_assist'),('ai_refine'),('ai_review'),('ai_cover_letter'),('pdf_download'),
('document_preview'),('photo_upload'),('resume_rename'),('document_settings');
UPDATE feature_prices SET mode='package_only',version=version+1;

ALTER TABLE cover_letters ADD COLUMN recipient_address VARCHAR(1000) NOT NULL DEFAULT '', ADD COLUMN letter_date DATE NULL;
UPDATE cover_letters SET letter_date=DATE(created_at) WHERE letter_date IS NULL;
