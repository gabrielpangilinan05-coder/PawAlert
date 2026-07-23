USE pawalert;

CREATE TABLE IF NOT EXISTS pet_media (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pet_id INT UNSIGNED NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    media_type ENUM('image','video') NOT NULL DEFAULT 'image',
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pet_media_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    INDEX idx_pet_media_pet (pet_id, sort_order)
) ENGINE=InnoDB;

INSERT INTO pet_media (pet_id, file_path, media_type, sort_order)
SELECT id, photo_path, 'image', 0
FROM pets
WHERE photo_path IS NOT NULL
  AND photo_path != ''
  AND id NOT IN (SELECT pet_id FROM pet_media);
