-- Up Migration

-- Galería de imágenes del título (fondos de la fuente externa) y cuándo se consultó.
ALTER TABLE contenido
  ADD COLUMN galeria jsonb,
  ADD COLUMN galeria_consultado_en timestamptz;

-- Down Migration

ALTER TABLE contenido
  DROP COLUMN galeria_consultado_en,
  DROP COLUMN galeria;
