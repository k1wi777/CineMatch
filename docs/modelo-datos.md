# Modelo de datos (PostgreSQL)

> **Fuente principal:** ERS CineMatch, sección 2.9 (diccionario de datos) y figura 3 (modelo entidad-relación). Copia en `docs/ERS CineMatch - Camilo Pacheco & José Padilla.zip`.
>
> **Complemento:** las issues de BE-1 a BE-13. Cuando una columna o restricción no está en el ERS, se indica con **(issue #N)**. Cuando el ERS y las issues difieren, se sigue la issue, salvo indicación contraria en [Decisiones de conflicto](#decisiones-de-conflicto).

## Convenciones

- **Nombres en `snake_case`** en la base de datos. El ERS usa nombres como `idUsuario` o `Usuario_idSolicitante`; el mapeo está en cada tabla. La API expone `camelCase` (issues #8 a #14).
- **Identificadores:** `id integer GENERATED ALWAYS AS IDENTITY` (equivale al `INT Auto-Increment` del ERS). Son `integer` y no `bigint` a propósito: ver [decisión 5](#decisiones-de-conflicto).
- **Tipos:** `DATETIME` → `timestamptz`; `TINYINT(1)` → `boolean`; `ENUM` → `CREATE TYPE` (issue #9).
- **Claves compuestas:** las tablas de relación usan PK compuesta, como indica el ERS.

## Enums

| Tipo SQL               | Valores                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `tipo_contenido`       | `pelicula`, `serie`                                                                                                                      |
| `estado_amistad`       | `pendiente`, `aceptada`, `rechazada`                                                                                                     |
| `visibilidad_resena`   | `publica`, `amigos`                                                                                                                      |
| `estado_biblioteca`    | `pendiente`, `viendo`, `vista`, `abandonada`                                                                                             |
| `estado_recomendacion` | `enviada`, `abierta`, `aceptada`, `descartada`, `completada`                                                                             |
| `tipo_notificacion`    | `recomendacion_recibida`, `recomendacion_aceptada`, `recomendacion_completada`, `solicitud_amistad`, `amistad_aceptada`, `resena_oculta` |

Los valores coinciden con `@cinematch/shared` (`packages/shared/src/domain/`).

## Tablas

### `rol`

| Columna  | Tipo        | Restricciones    | Fuente   |
| -------- | ----------- | ---------------- | -------- |
| `id`     | integer     | PK               | `idRol`  |
| `nombre` | varchar(30) | NOT NULL, UNIQUE | `nombre` |

Valores iniciales `usuario` y `administrador` (issue #13).

### `usuario`

| Columna             | Tipo         | Restricciones                                                                                  | Fuente            |
| ------------------- | ------------ | ---------------------------------------------------------------------------------------------- | ----------------- |
| `id`                | integer      | PK                                                                                             | `idUsuario`       |
| `nombre`            | varchar(100) | NOT NULL                                                                                       | `nombre`          |
| `username`          | varchar(20)  | NOT NULL; CHECK longitud ≥ 3 y `^[A-Za-z0-9_]+$`; UNIQUE sobre `lower(username)`               | `username` (RN17) |
| `correo`            | varchar(255) | NULL; UNIQUE parcial `WHERE correo IS NOT NULL`. Se pone en NULL al anonimizar (issue #9, #88) | `correo`          |
| `contrasena`        | varchar(255) | NOT NULL; hash `argon2id`                                                                      | `contrasena`      |
| `avatar_url`        | varchar(255) | NULL                                                                                           | `avatarUrl`       |
| `bio`               | varchar(300) | NULL                                                                                           | `bio`             |
| `fecha_registro`    | timestamptz  | NOT NULL                                                                                       | `fechaRegistro`   |
| `rol_id`            | integer      | NOT NULL; FK a `rol`                                                                           | `Rol_idRol`       |
| `acepta_datos_en`   | timestamptz  | NULL (obligatorio en el registro)                                                              | (issue #9, #24)   |
| `intentos_fallidos` | integer      | NOT NULL, DEFAULT 0                                                                            | (issue #9, #25)   |
| `bloqueado_hasta`   | timestamptz  | NULL                                                                                           | (issue #9, #25)   |
| `eliminado_en`      | timestamptz  | NULL                                                                                           | (issue #9, #88)   |

Anonimización (issue #88): `username` pasa a `eliminado_<id>`. Cabe en 20 caracteres mientras `id` sea `integer` (ver [decisión 5](#decisiones-de-conflicto)).

### `token_recuperacion`

| Columna            | Tipo        | Restricciones                                                          | Fuente              |
| ------------------ | ----------- | ---------------------------------------------------------------------- | ------------------- |
| `id`               | varchar(64) | PK. Hash SHA-256 del token enviado por correo, nunca el token en claro | (issue #27)         |
| `usuario_id`       | integer     | NOT NULL; FK a `usuario`                                               | `Usuario_idUsuario` |
| `fecha_expiracion` | timestamptz | NOT NULL. 1 hora después de crearlo                                    | `fechaExpiracion`   |
| `usado`            | boolean     | NOT NULL, DEFAULT false. Un solo uso                                   | `usado`             |

Limpieza de vencidos o usados con más de 24 h (issue #29). Al pedir uno nuevo se invalidan los anteriores (issue #27).

### `sesion` (solo en las issues, no está en el ERS)

| Columna            | Tipo         | Restricciones                                       | Fuente          |
| ------------------ | ------------ | --------------------------------------------------- | --------------- |
| `id`               | varchar(64)  | PK. Hash SHA-256 del token, nunca el token en claro | (issue #9, #25) |
| `usuario_id`       | integer      | NOT NULL; FK a `usuario`; índice                    | (issue #9)      |
| `creada_en`        | timestamptz  | NOT NULL                                            | (issue #25)     |
| `ultima_actividad` | timestamptz  | NOT NULL. Solo se actualiza si pasaron más de 60 s  | (issue #25)     |
| `ip`               | varchar(45)  | NULL. Admite IPv6                                   | (issue #9)      |
| `user_agent`       | varchar(255) | NULL (**supuesto**: longitud)                       | (issue #9)      |

Expira por inactividad de 30 minutos (`SESSION_IDLE_MINUTES`, RNF de seguridad del ERS).

### `genero`

| Columna  | Tipo        | Restricciones    | Fuente     |
| -------- | ----------- | ---------------- | ---------- |
| `id`     | integer     | PK               | `idGenero` |
| `nombre` | varchar(50) | NOT NULL, UNIQUE | `nombre`   |

### `interes_usuario`

| Columna      | Tipo    | Restricciones      | Fuente              |
| ------------ | ------- | ------------------ | ------------------- |
| `usuario_id` | integer | PK, FK a `usuario` | `Usuario_idUsuario` |
| `genero_id`  | integer | PK, FK a `genero`  | `Genero_idGenero`   |

El mínimo de 3 géneros lo valida la aplicación (RN13, ERS).

### `contenido`

| Columna               | Tipo             | Restricciones                                                      | Fuente               |
| --------------------- | ---------------- | ------------------------------------------------------------------ | -------------------- |
| `id`                  | integer          | PK                                                                 | `idContenido`        |
| `tipo`                | `tipo_contenido` | NOT NULL                                                           | `tipo`               |
| `titulo`              | varchar(255)     | NOT NULL. Índice GIN con `pg_trgm` (issue #10)                     | `titulo`             |
| `sinopsis`            | text             | NULL                                                               | `sinopsis`           |
| `anio`                | smallint         | NULL                                                               | `anio`               |
| `director`            | varchar(150)     | NULL. Director de película o creador de serie                      | `director`           |
| `duracion`            | smallint         | NULL. Minutos (película) o promedio por episodio (serie)           | `duracion`           |
| `poster_url`          | varchar(255)     | NULL                                                               | `posterUrl`          |
| `fuente`              | varchar(30)      | NOT NULL                                                           | `fuente`             |
| `id_externo`          | varchar(50)      | NOT NULL                                                           | `idExterno`          |
| `fecha_actualizacion` | timestamptz      | NOT NULL                                                           | `fechaActualizacion` |
| `popularidad_externa` | numeric(12,3)    | NULL. Necesaria para RN15 (issues #10, #42). **No está en el ERS** | (issue #10, #42)     |

- `UNIQUE (fuente, tipo, id_externo)`. Un mismo `id_externo` puede existir como película y como serie (ERS).
- RN16: una serie es una sola unidad, sin temporadas ni episodios.

### `contenido_genero`

| Columna        | Tipo    | Restricciones        | Fuente                  |
| -------------- | ------- | -------------------- | ----------------------- |
| `contenido_id` | integer | PK, FK a `contenido` | `Contenido_idContenido` |
| `genero_id`    | integer | PK, FK a `genero`    | `Genero_idGenero`       |

Comportamiento de `ON DELETE`: CASCADE, ver [decisiones confirmadas](#decisiones-confirmadas).

### `amistad`

| Columna           | Tipo             | Restricciones                 | Fuente                  |
| ----------------- | ---------------- | ----------------------------- | ----------------------- |
| `id`              | integer          | PK                            | `idAmistad`             |
| `solicitante_id`  | integer          | NOT NULL; FK a `usuario`      | `Usuario_idSolicitante` |
| `receptor_id`     | integer          | NOT NULL; FK a `usuario`      | `Usuario_idReceptor`    |
| `estado`          | `estado_amistad` | NOT NULL, DEFAULT `pendiente` | `estado`                |
| `fecha_solicitud` | timestamptz      | NOT NULL                      | `fechaSolicitud`        |
| `fecha_respuesta` | timestamptz      | NULL                          | `fechaRespuesta`        |

- `CHECK (solicitante_id <> receptor_id)`: sin autoamistad (ERS).
- Índice UNIQUE sobre `(LEAST(solicitante_id, receptor_id), GREATEST(solicitante_id, receptor_id))`: impide duplicados e inversas (ERS).

### `resena`

| Columna          | Tipo                 | Restricciones                                             | Fuente                  |
| ---------------- | -------------------- | --------------------------------------------------------- | ----------------------- |
| `id`             | integer              | PK                                                        | `idResena`              |
| `usuario_id`     | integer              | NOT NULL; FK a `usuario`                                  | `Usuario_idUsuario`     |
| `contenido_id`   | integer              | NOT NULL; FK a `contenido`                                | `Contenido_idContenido` |
| `calificacion`   | numeric(2,1)         | NOT NULL; CHECK entre 1.0 y 5.0 en pasos de 0,5           | `calificacion`          |
| `comentario`     | text                 | NULL; CHECK `char_length(comentario) <= 2000` (issue #60) | `comentario`            |
| `visibilidad`    | `visibilidad_resena` | NOT NULL, DEFAULT `publica`                               | `visibilidad`           |
| `es_spoiler`     | boolean              | NOT NULL, DEFAULT false                                   | `esSpoiler`             |
| `visible`        | boolean              | NOT NULL, DEFAULT true. `false` = oculta por moderación   | `visible`               |
| `fecha_creacion` | timestamptz          | NOT NULL                                                  | `fechaCreacion`         |
| `fecha_edicion`  | timestamptz          | NULL                                                      | `fechaEdicion`          |

- `UNIQUE (usuario_id, contenido_id)`: una reseña por usuario y título (ERS, RN1).
- Índice parcial `resena(contenido_id) WHERE visible` para promedios (issue #11).

### `etiqueta`

| Columna | Tipo        | Restricciones                                                               | Fuente       |
| ------- | ----------- | --------------------------------------------------------------------------- | ------------ |
| `id`    | integer     | PK                                                                          | `idEtiqueta` |
| `texto` | varchar(30) | NOT NULL, UNIQUE. Normalizada: minúsculas, sin tildes ni espacios sobrantes | `texto`      |

### `resena_etiqueta`

| Columna       | Tipo    | Restricciones                             | Fuente                |
| ------------- | ------- | ----------------------------------------- | --------------------- |
| `resena_id`   | integer | PK, FK a `resena` con `ON DELETE CASCADE` | `Resena_idResena`     |
| `etiqueta_id` | integer | PK, FK a `etiqueta`                       | `Etiqueta_idEtiqueta` |

Máximo 5 etiquetas por reseña: lo valida la aplicación (ERS, RN6).

### `seguimiento`

| Columna               | Tipo                | Restricciones              | Fuente                  |
| --------------------- | ------------------- | -------------------------- | ----------------------- |
| `id`                  | integer             | PK                         | `idSeguimiento`         |
| `usuario_id`          | integer             | NOT NULL; FK a `usuario`   | `Usuario_idUsuario`     |
| `contenido_id`        | integer             | NOT NULL; FK a `contenido` | `Contenido_idContenido` |
| `estado`              | `estado_biblioteca` | NOT NULL                   | `estado`                |
| `fecha_actualizacion` | timestamptz         | NOT NULL                   | `fechaActualizacion`    |

`UNIQUE (usuario_id, contenido_id)`: un solo estado por título y usuario (ERS).

### `recomendacion`

| Columna              | Tipo                   | Restricciones                                | Fuente                  |
| -------------------- | ---------------------- | -------------------------------------------- | ----------------------- |
| `id`                 | integer                | PK                                           | `idRecomendacion`       |
| `emisor_id`          | integer                | NOT NULL; FK a `usuario`                     | `Usuario_idEmisor`      |
| `receptor_id`        | integer                | NOT NULL; FK a `usuario`                     | `Usuario_idReceptor`    |
| `contenido_id`       | integer                | NOT NULL; FK a `contenido`                   | `Contenido_idContenido` |
| `resena_id`          | integer                | NULL; FK a `resena` con `ON DELETE SET NULL` | `Resena_idResena`       |
| `motivo`             | varchar(500)           | NULL                                         | `motivo`                |
| `fuera_de_intereses` | boolean                | NOT NULL, DEFAULT false                      | `fueraDeIntereses`      |
| `estado`             | `estado_recomendacion` | NOT NULL, DEFAULT `enviada`                  | `estado`                |
| `fecha_envio`        | timestamptz            | NOT NULL                                     | `fechaEnvio`            |
| `fecha_apertura`     | timestamptz            | NULL                                         | `fechaApertura`         |
| `fecha_respuesta`    | timestamptz            | NULL                                         | `fechaRespuesta`        |
| `fecha_completado`   | timestamptz            | NULL                                         | `fechaCompletado`       |

- `UNIQUE (emisor_id, receptor_id, contenido_id)`: una recomendación por combinación (ERS, RN11).
- `CHECK (emisor_id <> receptor_id)`: nunca a uno mismo (ERS).

### `notificacion`

| Columna                   | Tipo                | Restricciones                                                          | Fuente                          |
| ------------------------- | ------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| `id`                      | integer             | PK                                                                     | `idNotificacion`                |
| `usuario_destinatario_id` | integer             | NOT NULL; FK a `usuario`                                               | `Usuario_idDestinatario`        |
| `usuario_origen_id`       | integer             | NULL; FK a `usuario`. NULL si la origina el sistema o el administrador | `Usuario_idOrigen`              |
| `tipo`                    | `tipo_notificacion` | NOT NULL                                                               | `tipo`                          |
| `recomendacion_id`        | integer             | NULL; FK a `recomendacion`                                             | `Recomendacion_idRecomendacion` |
| `amistad_id`              | integer             | NULL; FK a `amistad`                                                   | `Amistad_idAmistad`             |
| `resena_id`               | integer             | NULL; FK a `resena`                                                    | `Resena_idResena`               |
| `leida`                   | boolean             | NOT NULL, DEFAULT false                                                | `leida`                         |
| `fecha_lectura`           | timestamptz         | NULL                                                                   | `fechaLectura`                  |
| `fecha_creacion`          | timestamptz         | NOT NULL                                                               | `fechaCreacion`                 |

- `CHECK`: exactamente una de `recomendacion_id`, `amistad_id` y `resena_id` no es NULL (ERS). Se expresa como `num_nonnulls(recomendacion_id, amistad_id, resena_id) = 1` (issue #12).
- Índice `(usuario_destinatario_id, leida, fecha_creacion DESC)` (issue #12).

### `auditoria_admin` (solo en las issues, no está en el ERS)

| Columna      | Tipo        | Restricciones                           | Fuente      |
| ------------ | ----------- | --------------------------------------- | ----------- |
| `id`         | integer     | PK                                      | (issue #86) |
| `admin_id`   | integer     | NOT NULL; FK a `usuario` (**supuesto**) | (issue #86) |
| `accion`     | varchar(50) | NOT NULL                                | (issue #86) |
| `entidad`    | varchar(50) | NOT NULL                                | (issue #86) |
| `entidad_id` | integer     | NULL                                    | (issue #86) |
| `detalle`    | jsonb       | NULL                                    | (issue #86) |
| `fecha`      | timestamptz | NOT NULL                                | (issue #86) |

## Decisiones de conflicto

Decididas por el criterio de seguir la issue cuando es más concreta o más reciente, y el ERS cuando la issue no dice nada. Aprobadas por el usuario.

| #   | Tema                            | ERS                                          | Issues                                                                      | Decisión                                                                                                                                             |
| --- | ------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `usuario.correo`                | NOT NULL, UNIQUE                             | NULLable con índice único parcial (#9); anonimización lo pone en NULL (#88) | **Issues.** Nullable con UNIQUE parcial.                                                                                                             |
| 2   | `contenido.popularidad_externa` | No existe                                    | Existe (#10, #42) y RN15 la necesita                                        | **Issues.** Se añade.                                                                                                                                |
| 3   | `sesion` y `auditoria_admin`    | No existen                                   | Existen (#9, #25, #86)                                                      | **Issues.** Se añaden con sus campos.                                                                                                                |
| 4   | `token_recuperacion`            | `idToken` + `tokenHash` + `usado`            | `id` = hash (#27)                                                           | **Issues.** `id` es el hash; se elimina `tokenHash`. Se mantiene `usado`.                                                                            |
| 5   | Username anonimizado            | `username` VARCHAR(20) con CHECK 3–20        | `eliminado_<id>` (#88)                                                      | **Resuelto con `integer`.** `eliminado_` (10 caracteres) más un id de hasta 10 dígitos cabe en 20. Con `bigint` no cabría, por eso se usa `integer`. |
| 6   | `resena.comentario`             | TEXT sin límite                              | Máximo 2000 caracteres (#60)                                                | **Issues.** `CHECK` de 2000 caracteres.                                                                                                              |
| 7   | Nombres de columnas             | Estilo ERS (`idUsuario`, `Usuario_idEmisor`) | `snake_case` (#8 a #14)                                                     | **Issues.** `snake_case`.                                                                                                                            |
| 8   | Hash de contraseña              | Ejemplo `bcrypt`                             | `argon2id` (README y #24)                                                   | **Issues.** `argon2id`.                                                                                                                              |
| 9   | `notificacion.fecha_lectura`    | Existe                                       | Solo se menciona `leida`                                                    | **ERS.** Se mantiene.                                                                                                                                |

## Preguntas abiertas

Ninguna bloquea BE-1.

1. **Política de contraseñas** (longitud mínima y reglas). Se define en BE-3.1 (#24).

## Decisiones confirmadas

- **ON DELETE:** CASCADE en contenido_genero e interes_usuario. Sin acción en las FKs a usuario, porque los usuarios se anonimizan y no se borran (#88).
- **contenido.fuente:** `tmdb` para datos reales y mock para pruebas y desarrollo sin clave (#42).
- **Origen de notificaciones:** al borrarse la recomendación, amistad o reseña que origina una notificación, la notificación se borra en cascada (BE-1.5). **Decidido.**

## Resueltas por el ERS

- **Longitud de `nombre` y `bio`:** 100 y 300 caracteres.
- **Tipo de `calificacion`:** `DECIMAL(2,1)`.
- **RN16:** las series son una sola unidad.
- **Mínimo de géneros y etiquetas por reseña:** los valida la aplicación.
- **`ENUM` y `CREATE TYPE`:** se usan para todas las listas cerradas.
- **Restricciones de `amistad`, `recomendacion`, `notificacion` y `resena_etiqueta`:** definidas en el ERS.
