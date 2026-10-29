-- Up Migration

-- Imagen horizontal (fondo) del título, para el carrusel de destacados del inicio.
ALTER TABLE contenido ADD COLUMN fondo_url varchar(255);

-- Down Migration

ALTER TABLE contenido DROP COLUMN fondo_url;
