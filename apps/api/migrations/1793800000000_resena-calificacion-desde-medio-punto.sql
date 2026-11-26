-- Up Migration

-- Las calificaciones van de 0,5 a 5 en pasos de 0,5 (RN1 del ERS). Antes el mínimo era 1.
ALTER TABLE resena DROP CONSTRAINT resena_calificacion_rango_paso;
ALTER TABLE resena ADD CONSTRAINT resena_calificacion_rango_paso CHECK (
  calificacion BETWEEN 0.5 AND 5 AND calificacion * 2 = floor(calificacion * 2)
);

-- Down Migration

-- Falla si hay reseñas con calificación menor que 1; hay que tratarlas antes de bajar la migración.
ALTER TABLE resena DROP CONSTRAINT resena_calificacion_rango_paso;
ALTER TABLE resena ADD CONSTRAINT resena_calificacion_rango_paso CHECK (
  calificacion BETWEEN 1 AND 5 AND calificacion * 2 = floor(calificacion * 2)
);
