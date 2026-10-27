-- Up Migration

-- BE-1.5: recomendaciones dirigidas y notificaciones.
-- Fuente: docs/modelo-datos.md e issue #12.

CREATE TYPE estado_recomendacion AS ENUM (
  'enviada',
  'abierta',
  'aceptada',
  'descartada',
  'completada'
);

CREATE TYPE tipo_notificacion AS ENUM (
  'recomendacion_recibida',
  'recomendacion_aceptada',
  'recomendacion_completada',
  'solicitud_amistad',
  'amistad_aceptada',
  'resena_oculta'
);

CREATE TABLE recomendacion (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  emisor_id integer NOT NULL REFERENCES usuario (id),
  receptor_id integer NOT NULL REFERENCES usuario (id),
  contenido_id integer NOT NULL REFERENCES contenido (id),
  resena_id integer REFERENCES resena (id) ON DELETE SET NULL,
  motivo varchar(500),
  fuera_de_intereses boolean NOT NULL DEFAULT false,
  estado estado_recomendacion NOT NULL DEFAULT 'enviada',
  fecha_envio timestamptz NOT NULL DEFAULT now(),
  fecha_apertura timestamptz,
  fecha_respuesta timestamptz,
  fecha_completado timestamptz,
  CONSTRAINT recomendacion_no_a_uno_mismo CHECK (emisor_id <> receptor_id),
  CONSTRAINT recomendacion_emisor_receptor_contenido_key UNIQUE (emisor_id, receptor_id, contenido_id)
);

CREATE TABLE notificacion (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_destinatario_id integer NOT NULL REFERENCES usuario (id),
  usuario_origen_id integer REFERENCES usuario (id),
  tipo tipo_notificacion NOT NULL,
  recomendacion_id integer REFERENCES recomendacion (id) ON DELETE CASCADE,
  amistad_id integer REFERENCES amistad (id) ON DELETE CASCADE,
  resena_id integer REFERENCES resena (id) ON DELETE CASCADE,
  leida boolean NOT NULL DEFAULT false,
  fecha_lectura timestamptz,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  -- Cada notificación referencia exactamente un origen (ERS).
  CONSTRAINT notificacion_un_solo_origen CHECK (
    num_nonnulls(recomendacion_id, amistad_id, resena_id) = 1
  )
);

-- Consulta de no leídas por usuario, de la más reciente a la más antigua.
CREATE INDEX notificacion_destinatario_leida_idx ON notificacion (
  usuario_destinatario_id,
  leida,
  fecha_creacion DESC
);

-- Down Migration

DROP TABLE notificacion;
DROP TABLE recomendacion;
DROP TYPE tipo_notificacion;
DROP TYPE estado_recomendacion;
