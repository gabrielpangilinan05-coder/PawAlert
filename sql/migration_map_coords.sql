-- Map coordinates for home address, last-seen, and feed alerts
ALTER TABLE users
    ADD COLUMN address_lat DECIMAL(10,7) DEFAULT NULL AFTER address,
    ADD COLUMN address_lng DECIMAL(10,7) DEFAULT NULL AFTER address_lat;

ALTER TABLE pets
    ADD COLUMN last_seen_lat DECIMAL(10,7) DEFAULT NULL AFTER last_seen_text,
    ADD COLUMN last_seen_lng DECIMAL(10,7) DEFAULT NULL AFTER last_seen_lat,
    ADD COLUMN home_lat DECIMAL(10,7) DEFAULT NULL AFTER show_address,
    ADD COLUMN home_lng DECIMAL(10,7) DEFAULT NULL AFTER home_lat;

ALTER TABLE posts
    ADD COLUMN location_lat DECIMAL(10,7) DEFAULT NULL AFTER location_text,
    ADD COLUMN location_lng DECIMAL(10,7) DEFAULT NULL AFTER location_lat;
