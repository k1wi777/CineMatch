-- Up Migration

-- BE-1.2: roles, usuarios, recuperación de contraseña y sesiones.
-- Fuente: docs/modelo-datos.md y issue #9.

CREATE TABLE rol (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(30) NOT NULL UNIQUE
);

CREATE TABLE usuario (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(100) NOT NULL,
  username varchar(20) NOT NULL,
  correo varchar(255),
  contrasena varchar(255) NOT NULL,
  avatar_url varchar(255),
  bio varchar(300),
  fecha_registro timestamptz NOT NULL DEFAULT now(),
  rol_id integer NOT NULL REFERENCES rol (id),
  acepta_datos_en timestamptz,
  intentos_fallidos integer NOT NULL DEFAULT 0,
  bloqueado_hasta timestamptz,
  eliminado_en timestamptz,
  CONSTRAINT usuario_username_formato CHECK (
    char_length(username) >= 3 AND username ~ '^[A-Za-z0-9_]+$'
  )
);

-- Username único sin distinguir mayúsculas (RN17).
CREATE UNIQUE INDEX usuario_username_lower_key ON usuario (lower(username));

-- Correo único sin distinguir mayúsculas, solo cuando existe: la anonimización lo deja en NULL (issue #88).
CREATE UNIQUE INDEX usuario_correo_lower_key ON usuario (lower(correo)) WHERE correo IS NOT NULL;

CREATE TABLE token_recuperacion (
  id varchar(64) PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuario (id),
  fecha_expiracion timestamptz NOT NULL,
  usado boolean NOT NULL DEFAULT false
);

CREATE INDEX token_recuperacion_usuario_id_idx ON token_recuperacion (usuario_id);

CREATE TABLE sesion (
  id varchar(64) PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuario (id),
  creada_en timestamptz NOT NULL DEFAULT now(),
  ultima_actividad timestamptz NOT NULL DEFAULT now(),
  ip varchar(45),
  user_agent varchar(255)
);

CREATE INDEX sesion_usuario_id_idx ON sesion (usuario_id);

-- Down Migration

DROP TABLE sesion;
DROP TABLE token_recuperacion;
DROP TABLE usuario;
DROP TABLE rol;
