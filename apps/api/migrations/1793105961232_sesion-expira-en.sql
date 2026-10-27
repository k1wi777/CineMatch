-- Up Migration

-- BE-3.2: la sesión guarda su fecha de vencimiento (docs: decisiones cerradas de la sección 2).
-- La tabla está vacía en todos los entornos existentes, así que el NOT NULL no necesita valor por defecto.
ALTER TABLE sesion ADD COLUMN expira_en timestamptz NOT NULL;

-- Down Migration

ALTER TABLE sesion DROP COLUMN expira_en;
