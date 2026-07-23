USE pawalert;

ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS contact_email VARCHAR(190) DEFAULT NULL AFTER contact_phone;

UPDATE posts p
JOIN users u ON u.id = p.user_id
SET p.contact_email = u.email
WHERE p.contact_email IS NULL;
