-- Up Migration

-- BE-3.1: la aceptación del tratamiento de datos es obligatoria (Ley 1581; sección 2).
-- Las filas existentes sin fecha (por ejemplo, el administrador creado por el seed) toman la fecha de registro.
UPDATE usuario SET acepta_datos_en = fecha_registro WHERE acepta_datos_en IS NULL;

ALTER TABLE usuario ALTER COLUMN acepta_datos_en SET NOT NULL;

-- Down Migration

ALTER TABLE usuario ALTER COLUMN acepta_datos_en DROP NOT NULL;
