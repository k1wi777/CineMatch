-- Up Migration

-- BE-1.4: amistades, reseñas, etiquetas y biblioteca.
-- Fuente: docs/modelo-datos.md e issue #11.

CREATE TYPE estado_amistad AS ENUM ('pendiente', 'aceptada', 'rechazada');

CREATE TYPE visibilidad_resena AS ENUM ('publica', 'amigos');

CREATE TYPE estado_biblioteca AS ENUM ('pendiente', 'viendo', 'vista', 'abandonada');

CREATE TABLE amistad (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitante_id integer NOT NULL REFERENCES usuario (id),
  receptor_id integer NOT NULL REFERENCES usuario (id),
  estado estado_amistad NOT NULL DEFAULT 'pendiente',
  fecha_solicitud timestamptz NOT NULL DEFAULT now(),
  fecha_respuesta timestamptz,
  CONSTRAINT amistad_no_autoamistad CHECK (solicitante_id <> receptor_id)
);

-- Un único registro por par de usuarios, sin importar quién envió la solicitud (RN10).
CREATE UNIQUE INDEX amistad_par_key ON amistad (
  LEAST(solicitante_id, receptor_id),
  GREATEST(solicitante_id, receptor_id)
);

CREATE INDEX amistad_receptor_id_idx ON amistad (receptor_id);

CREATE TABLE resena (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuario (id),
  contenido_id integer NOT NULL REFERENCES contenido (id),
  calificacion numeric(2, 1) NOT NULL,
  comentario text,
  visibilidad visibilidad_resena NOT NULL DEFAULT 'publica',
  es_spoiler boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_edicion timestamptz,
  CONSTRAINT resena_calificacion_rango_paso CHECK (
    calificacion BETWEEN 1 AND 5 AND calificacion * 2 = floor(calificacion * 2)
  ),
  CONSTRAINT resena_comentario_longitud CHECK (char_length(comentario) <= 2000),
  CONSTRAINT resena_usuario_contenido_key UNIQUE (usuario_id, contenido_id)
);

-- Promedios: solo cuentan las reseñas no ocultas por moderación.
CREATE INDEX resena_contenido_visible_idx ON resena (contenido_id) WHERE visible;

CREATE TABLE etiqueta (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  texto varchar(30) NOT NULL UNIQUE
);

CREATE TABLE resena_etiqueta (
  resena_id integer NOT NULL REFERENCES resena (id) ON DELETE CASCADE,
  etiqueta_id integer NOT NULL REFERENCES etiqueta (id),
  PRIMARY KEY (resena_id, etiqueta_id)
);

CREATE INDEX resena_etiqueta_etiqueta_id_idx ON resena_etiqueta (etiqueta_id);

CREATE TABLE seguimiento (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuario (id),
  contenido_id integer NOT NULL REFERENCES contenido (id),
  estado estado_biblioteca NOT NULL,
  fecha_actualizacion timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seguimiento_usuario_contenido_key UNIQUE (usuario_id, contenido_id)
);

-- Down Migration

DROP TABLE seguimiento;
DROP TABLE resena_etiqueta;
DROP TABLE etiqueta;
DROP TABLE resena;
DROP TABLE amistad;
DROP TYPE estado_biblioteca;
DROP TYPE visibilidad_resena;
DROP TYPE estado_amistad;
