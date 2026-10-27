-- Up Migration

-- BE-1.3: géneros, catálogo e intereses de usuario.
-- Fuente: docs/modelo-datos.md e issue #10.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE tipo_contenido AS ENUM ('pelicula', 'serie');

CREATE TABLE genero (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(50) NOT NULL UNIQUE
);

CREATE TABLE contenido (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo tipo_contenido NOT NULL,
  titulo varchar(255) NOT NULL,
  sinopsis text,
  anio smallint,
  director varchar(150),
  duracion smallint,
  poster_url varchar(255),
  fuente varchar(30) NOT NULL,
  id_externo varchar(50) NOT NULL,
  fecha_actualizacion timestamptz NOT NULL,
  popularidad_externa numeric(12, 3),
  CONSTRAINT contenido_fuente_tipo_id_externo_key UNIQUE (fuente, tipo, id_externo)
);

-- Búsqueda por título con coincidencias parciales (pg_trgm).
CREATE INDEX contenido_titulo_trgm_idx ON contenido USING gin (titulo gin_trgm_ops);

CREATE INDEX contenido_tipo_idx ON contenido (tipo);

CREATE TABLE contenido_genero (
  contenido_id integer NOT NULL REFERENCES contenido (id) ON DELETE CASCADE,
  genero_id integer NOT NULL REFERENCES genero (id) ON DELETE CASCADE,
  PRIMARY KEY (contenido_id, genero_id)
);

CREATE INDEX contenido_genero_genero_id_idx ON contenido_genero (genero_id);

CREATE TABLE interes_usuario (
  usuario_id integer NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  genero_id integer NOT NULL REFERENCES genero (id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, genero_id)
);

CREATE INDEX interes_usuario_genero_id_idx ON interes_usuario (genero_id);

-- Down Migration

DROP TABLE interes_usuario;
DROP TABLE contenido_genero;
DROP TABLE contenido;
DROP TABLE genero;
DROP TYPE tipo_contenido;
DROP EXTENSION IF EXISTS pg_trgm;
