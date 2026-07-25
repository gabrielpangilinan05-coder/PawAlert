-- Multiple photos/videos per post
CREATE TABLE IF NOT EXISTS post_media (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    post_id INT UNSIGNED NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    media_type ENUM('image','video') NOT NULL DEFAULT 'image',
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_media_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    INDEX idx_post_media_post (post_id, sort_order)
) ENGINE=InnoDB;

-- Backfill cover photo into post_media when missing
INSERT INTO post_media (post_id, file_path, media_type, sort_order)
SELECT p.id, p.photo_path, COALESCE(p.media_type, 'image'), 0
FROM posts p
WHERE p.photo_path IS NOT NULL
  AND p.photo_path <> ''
  AND NOT EXISTS (
    SELECT 1 FROM post_media pm WHERE pm.post_id = p.id
  );
