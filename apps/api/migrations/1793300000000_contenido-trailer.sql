-- Up Migration

-- Enlace al tráiler de YouTube (solo el enlace, nunca el video) y cuándo se consultó en la fuente externa.
ALTER TABLE contenido
  ADD COLUMN trailer_url varchar(255),
  ADD COLUMN trailer_consultado_en timestamptz;

-- Down Migration

ALTER TABLE contenido
  DROP COLUMN trailer_consultado_en,
  DROP COLUMN trailer_url;
