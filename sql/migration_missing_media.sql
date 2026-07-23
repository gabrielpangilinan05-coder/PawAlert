USE pawalert;

ALTER TABLE pets ADD COLUMN IF NOT EXISTS last_seen_at DATETIME DEFAULT NULL AFTER last_seen_text;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS last_seen_media_path VARCHAR(255) DEFAULT NULL AFTER last_seen_at;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS last_seen_media_type ENUM('image','video') DEFAULT NULL AFTER last_seen_media_path;
