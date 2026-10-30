-- Up Migration

-- Reparto principal del título (nombres, en orden de importancia) y cuándo se consultó en la fuente externa.
ALTER TABLE contenido
  ADD COLUMN reparto jsonb,
  ADD COLUMN reparto_consultado_en timestamptz;

-- Down Migration

ALTER TABLE contenido
  DROP COLUMN reparto_consultado_en,
  DROP COLUMN reparto;
