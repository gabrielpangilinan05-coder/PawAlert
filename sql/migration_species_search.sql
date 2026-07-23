USE pawalert;

UPDATE pets SET species = 'Dog' WHERE species = 'dog';
UPDATE pets SET species = 'Cat' WHERE species = 'cat';
UPDATE pets SET species = 'Other' WHERE species = 'other';

UPDATE posts SET species = 'Dog' WHERE species = 'dog';
UPDATE posts SET species = 'Cat' WHERE species = 'cat';
UPDATE posts SET species = 'Other' WHERE species = 'other';

ALTER TABLE pets MODIFY COLUMN species VARCHAR(80) NOT NULL DEFAULT 'Dog';
ALTER TABLE posts MODIFY COLUMN species VARCHAR(80) NOT NULL DEFAULT 'Other';
