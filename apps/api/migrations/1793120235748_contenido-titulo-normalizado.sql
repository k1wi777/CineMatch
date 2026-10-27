-- Up Migration

-- BE-6.4: búsqueda sin distinguir mayúsculas ni tildes.
-- Columna generada (inmutable) con el título en minúsculas y sin acentos, indexada con pg_trgm.
ALTER TABLE contenido ADD COLUMN titulo_normalizado varchar(255) GENERATED ALWAYS AS (
  translate(lower(titulo), 'áéíóúüñ', 'aeiouun')
) STORED;

CREATE INDEX contenido_titulo_normalizado_trgm_idx ON contenido USING gin (titulo_normalizado gin_trgm_ops);

-- Down Migration

DROP INDEX contenido_titulo_normalizado_trgm_idx;

ALTER TABLE contenido DROP COLUMN titulo_normalizado;
