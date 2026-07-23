-- Extra details when marking a pet Missing
ALTER TABLE pets
  ADD COLUMN last_seen_notes TEXT DEFAULT NULL AFTER last_seen_text;
