USE pawalert;

ALTER TABLE pets
    ADD COLUMN sex ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown'
    AFTER breed;
