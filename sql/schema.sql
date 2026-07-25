CREATE DATABASE IF NOT EXISTS pawalert CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pawalert;

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    phone VARCHAR(40) DEFAULT NULL,
    messenger VARCHAR(190) DEFAULT NULL,
    address VARCHAR(255) DEFAULT NULL,
    address_lat DECIMAL(10,7) DEFAULT NULL,
    address_lng DECIMAL(10,7) DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user','admin') NOT NULL DEFAULT 'user',
    banned_at DATETIME DEFAULT NULL,
    ban_reason VARCHAR(255) DEFAULT NULL,
    email_verified_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE otps (
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

CREATE TABLE pets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    species VARCHAR(80) NOT NULL DEFAULT 'Dog',
    breed VARCHAR(120) DEFAULT NULL,
    sex ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown',
    photo_path VARCHAR(255) DEFAULT NULL,
    medical_notes TEXT DEFAULT NULL,
    status ENUM('safe','missing') NOT NULL DEFAULT 'safe',
    public_slug VARCHAR(32) NOT NULL UNIQUE,
    last_seen_text VARCHAR(255) DEFAULT NULL,
    last_seen_notes TEXT DEFAULT NULL,
    last_seen_lat DECIMAL(10,7) DEFAULT NULL,
    last_seen_lng DECIMAL(10,7) DEFAULT NULL,
    last_seen_at DATETIME DEFAULT NULL,
    last_seen_media_path VARCHAR(255) DEFAULT NULL,
    last_seen_media_type ENUM('image','video') DEFAULT NULL,
    show_phone TINYINT(1) NOT NULL DEFAULT 1,
    show_email TINYINT(1) NOT NULL DEFAULT 0,
    show_messenger TINYINT(1) NOT NULL DEFAULT 1,
    show_address TINYINT(1) NOT NULL DEFAULT 0,
    home_lat DECIMAL(10,7) DEFAULT NULL,
    home_lng DECIMAL(10,7) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE pet_media (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pet_id INT UNSIGNED NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    media_type ENUM('image','video') NOT NULL DEFAULT 'image',
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pet_media_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    INDEX idx_pet_media_pet (pet_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE posts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    pet_id INT UNSIGNED DEFAULT NULL,
    type ENUM('found','missing','story','tip','question') NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    species VARCHAR(80) NOT NULL DEFAULT 'Other',
    photo_path VARCHAR(255) DEFAULT NULL,
    media_type ENUM('image','video') DEFAULT NULL,
    location_text VARCHAR(255) DEFAULT NULL,
    location_lat DECIMAL(10,7) DEFAULT NULL,
    location_lng DECIMAL(10,7) DEFAULT NULL,
    contact_name VARCHAR(120) DEFAULT NULL,
    contact_phone VARCHAR(40) DEFAULT NULL,
    contact_email VARCHAR(190) DEFAULT NULL,
    status ENUM('open','resolved') NOT NULL DEFAULT 'open',
    share_count INT UNSIGNED NOT NULL DEFAULT 0,
    hidden_at DATETIME DEFAULT NULL,
    hidden_reason VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_posts_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE SET NULL,
    INDEX idx_posts_type_status (type, status),
    INDEX idx_posts_created (created_at),
    INDEX idx_posts_hidden (hidden_at)
) ENGINE=InnoDB;

CREATE TABLE post_media (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    post_id INT UNSIGNED NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    media_type ENUM('image','video') NOT NULL DEFAULT 'image',
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_media_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    INDEX idx_post_media_post (post_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE reports (
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

CREATE TABLE post_likes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    post_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_post_user_like (post_id, user_id),
    CONSTRAINT fk_likes_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE post_comments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    post_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_comments_post (post_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE follows (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    follower_id INT UNSIGNED NOT NULL,
    following_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_follow (follower_id, following_id),
    CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_follows_following FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_follows_following (following_id)
) ENGINE=InnoDB;

CREATE TABLE messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_id INT UNSIGNED NOT NULL,
    receiver_id INT UNSIGNED NOT NULL,
    body TEXT NOT NULL,
    read_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_messages_pair (sender_id, receiver_id, created_at),
    INDEX idx_messages_inbox (receiver_id, read_at, created_at)
) ENGINE=InnoDB;

CREATE TABLE notifications (
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
