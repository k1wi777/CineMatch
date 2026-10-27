-- Up Migration

-- BE-12.4: trazabilidad de las acciones de administración (sincronización y moderación).
-- Sin endpoint de consulta en esta fase.
CREATE TABLE auditoria_admin (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id integer NOT NULL REFERENCES usuario (id),
  accion varchar(50) NOT NULL,
  entidad varchar(50) NOT NULL,
  entidad_id integer,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  fecha timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auditoria_admin_admin_id_idx ON auditoria_admin (admin_id);

-- Down Migration

DROP TABLE auditoria_admin;
