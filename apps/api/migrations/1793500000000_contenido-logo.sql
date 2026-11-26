-- Up Migration

-- Logotipo del título (imagen con el nombre), para el carrusel del inicio, y cuándo se consultó en la fuente externa.
ALTER TABLE contenido
  ADD COLUMN logo_url varchar(255),
  ADD COLUMN logo_consultado_en timestamptz;

-- Down Migration

ALTER TABLE contenido
  DROP COLUMN logo_consultado_en,
  DROP COLUMN logo_url;
