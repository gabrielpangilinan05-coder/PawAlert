-- Moderation + admin role
USE pawalert;

ALTER TABLE users
  ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user' AFTER password_hash,
  ADD COLUMN banned_at DATETIME DEFAULT NULL AFTER role,
  ADD COLUMN ban_reason VARCHAR(255) DEFAULT NULL AFTER banned_at;

ALTER TABLE posts
  ADD COLUMN hidden_at DATETIME DEFAULT NULL AFTER share_count,
  ADD COLUMN hidden_reason VARCHAR(255) DEFAULT NULL AFTER hidden_at;

CREATE TABLE IF NOT EXISTS reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id INT UNSIGNED DEFAULT NULL,
  target_type ENUM('post','user') NOT NULL,
  target_id INT UNSIGNED NOT NULL,
  reason VARCHAR(255) NOT NULL,
  details TEXT DEFAULT NULL,
  status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  resolved_by INT UNSIGNED DEFAULT NULL,
  resolved_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reports_status (status, created_at),
  INDEX idx_reports_target (target_type, target_id),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_resolver FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Bootstrap: promote known owner account (safe if email missing)
UPDATE users SET role = 'admin' WHERE email = 'gabrielpangilinan05@gmail.com';
