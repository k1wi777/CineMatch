# Transacciones y repositorios

La base de datos se usa con `pg`, sin ORM. Todo el acceso pasa por `src/lib/db.ts`.

## Reglas

- **Un repositorio recibe un `executor` opcional**: `Executor` es el pool o un cliente de transacción. Así el mismo método funciona fuera de una transacción y dentro de una, sin cambiar su firma.
- **Si una operación escribe en más de una tabla, va en `withTransaction`.** Si una escritura falla, todas se revierten.
- **Los efectos externos van en `afterCommit`**: emitir SSE, enviar correos o avisar a otros módulos. Solo se ejecutan si la transacción confirma, en el orden en que se registraron.
- **`afterCommit` no sirve para revertir nada.** Si un hook falla, la transacción ya está confirmada y el error llega al llamador.

## Ejemplo

```ts
import { afterCommit, withTransaction, type Executor } from "../../lib/db.js";

// Repositorio: acepta el pool o una transacción.
export async function insertarRecomendacion(
  executor: Executor,
  datos: NuevaRecomendacion,
): Promise<number> {
  const { rows } = await executor.query<{ id: number }>(
    "INSERT INTO recomendacion (emisor_id, receptor_id, contenido_id, motivo, fecha_envio) VALUES ($1, $2, $3, $4, now()) RETURNING id",
    [datos.emisorId, datos.receptorId, datos.contenidoId, datos.motivo],
  );
  return rows[0]?.id ?? 0;
}

// Servicio: coordina varias escrituras en una sola transacción.
await withTransaction(pool, async (tx) => {
  const id = await insertarRecomendacion(tx, datos);
  await insertarNotificacion(tx, datos);
  afterCommit(tx, () => emitirRecomendacion(id));
});
```

## Pool y apagado

- `createPool` (en `src/lib/db.ts`) configura el pool con `DATABASE_URL` y un tiempo de espera de conexión.
- `server.ts` cierra el pool en `SIGINT` y `SIGTERM`, después de cerrar el servidor HTTP y las conexiones SSE.

## Pruebas

`test/integration/transacciones.test.ts` cubre:

- que una transacción confirma o revierte según el resultado;
- que `afterCommit` se ejecuta solo tras el `COMMIT`, en orden;
- que un repositorio funciona igual con el pool y con una transacción.
