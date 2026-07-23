-- In-app notification center
CREATE TABLE IF NOT EXISTS notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    actor_id INT UNSIGNED DEFAULT NULL,
    type ENUM('comment','message','share') NOT NULL,
    title VARCHAR(160) NOT NULL,
    body VARCHAR(500) DEFAULT NULL,
    link VARCHAR(255) NOT NULL,
    post_id INT UNSIGNED DEFAULT NULL,
    read_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_notifications_inbox (user_id, read_at, created_at),
    INDEX idx_notifications_user_created (user_id, created_at)
) ENGINE=InnoDB;
