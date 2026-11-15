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
