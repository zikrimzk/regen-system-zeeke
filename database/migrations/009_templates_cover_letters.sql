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
