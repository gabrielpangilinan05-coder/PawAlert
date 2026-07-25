-- Owner profile photo
ALTER TABLE users
    ADD COLUMN avatar_path VARCHAR(255) DEFAULT NULL AFTER address_lng;
