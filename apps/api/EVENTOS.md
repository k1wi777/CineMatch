# Eventos de dominio

El bus está en `src/lib/events.ts`. Los eventos se emiten desde los servicios, y cada módulo registra sus listeners al arrancar en `src/modules/registro-eventos.ts`.

## Modos

| Método                                   | Cuándo corre el listener                    | Si el listener falla                     |
| ---------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| `emit(tx, evento, payload)`              | Tras el `COMMIT` de `tx` (`afterCommit`)    | Se registra en el log y no revierte nada |
| `emitInTransaction(tx, evento, payload)` | Dentro de la transacción, con el mismo `tx` | Se revierte toda la transacción          |

Los listeners se registran con `bus.on(evento, fn)` para el modo `emit` y con `bus.onInTransaction(evento, fn)` para el modo transaccional.

## Eventos

| Evento                                                                                   | Payload                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `review.created`, `review.updated`, `review.deleted`, `review.hidden`, `review.restored` | `{ reviewId, userId, contentId }`                       |
| `friendship.requested`, `friendship.accepted`                                            | `{ friendshipId, requesterId, receiverId }`             |
| `recommendation.sent`, `recommendation.accepted`, `recommendation.completed`             | `{ recommendationId, senderId, receiverId, contentId }` |

El tipo de cada payload se comprueba al compilar.

## Ejemplo

```ts
await withTransaction(pool, async (tx) => {
  const id = await insertarResena(tx, datos);
  await bus.emitInTransaction(tx, "review.created", { reviewId: id, userId, contentId }); // mismo tx
  bus.emit(tx, "review.created", { reviewId: id, userId, contentId }); // tras el COMMIT
});
```

Las notificaciones (BE-5) y la biblioteca (BE-8.3) usan `emitInTransaction` cuando deben confirmarse junto con la operación. El SSE y los correos usan `emit`.
