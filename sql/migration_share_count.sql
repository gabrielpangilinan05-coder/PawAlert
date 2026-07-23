-- Share engagement counter for feed posts
ALTER TABLE posts
  ADD COLUMN share_count INT UNSIGNED NOT NULL DEFAULT 0;
