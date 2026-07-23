-- Run once on existing PawAlert DB
USE pawalert;

CREATE TABLE IF NOT EXISTS otps (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    channel ENUM('email','phone') NOT NULL DEFAULT 'email',
    destination VARCHAR(190) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(40) NOT NULL DEFAULT 'register',
    expires_at DATETIME NOT NULL,
    used_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_otps_dest (destination, purpose),
    INDEX idx_otps_expires (expires_at)
) ENGINE=InnoDB;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified_at DATETIME DEFAULT NULL AFTER password_hash;
