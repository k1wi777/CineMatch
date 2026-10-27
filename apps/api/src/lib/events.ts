import type pg from "pg";
import { afterCommit } from "./db.js";

// Eventos de dominio y su payload. Cada módulo emite solo los suyos.
export type EventosDeDominio = {
  "review.created": { reviewId: number; userId: number; contentId: number };
  "review.updated": { reviewId: number; userId: number; contentId: number };
  "review.deleted": { reviewId: number; userId: number; contentId: number };
  "review.hidden": { reviewId: number; userId: number; contentId: number };
  "review.restored": { reviewId: number; userId: number; contentId: number };
  "friendship.requested": { friendshipId: number; requesterId: number; receiverId: number };
  "friendship.accepted": { friendshipId: number; requesterId: number; receiverId: number };
  "recommendation.sent": {
    recommendationId: number;
    senderId: number;
    receiverId: number;
    contentId: number;
  };
  "recommendation.accepted": {
    recommendationId: number;
    senderId: number;
    receiverId: number;
    contentId: number;
  };
  "recommendation.completed": {
    recommendationId: number;
    senderId: number;
    receiverId: number;
    contentId: number;
  };
};

export type NombreEvento = keyof EventosDeDominio;

type ListenerTras<E extends NombreEvento> = (payload: EventosDeDominio[E]) => void | Promise<void>;
type ListenerEnTransaccion<E extends NombreEvento> = (
  payload: EventosDeDominio[E],
  tx: pg.PoolClient,
) => void | Promise<void>;

type ListenerGenerico = (payload: unknown, tx: pg.PoolClient) => void | Promise<void>;
type Registro = { modo: "tras-commit" | "en-transaccion"; listener: ListenerGenerico };

type LoggerDeEventos = { error: (obj: object, msg: string) => void };

// Bus de eventos en memoria, con dos modos:
// - emit: los listeners se ejecutan tras el COMMIT. Si uno falla, el error se registra y no revierte nada.
// - emitInTransaction: los listeners comparten la transacción. Si uno falla, se revierte todo.
export class EventBus {
  private readonly registros = new Map<NombreEvento, Registro[]>();

  constructor(private readonly logger: LoggerDeEventos) {}

  on<E extends NombreEvento>(nombre: E, listener: ListenerTras<E>): void {
    this.registrar(nombre, { modo: "tras-commit", listener: listener as ListenerGenerico });
  }

  onInTransaction<E extends NombreEvento>(nombre: E, listener: ListenerEnTransaccion<E>): void {
    this.registrar(nombre, { modo: "en-transaccion", listener: listener as ListenerGenerico });
  }

  // Programa los listeners tras el COMMIT de la transacción `tx`. Solo se ejecutan si confirma.
  emit<E extends NombreEvento>(tx: pg.PoolClient, nombre: E, payload: EventosDeDominio[E]): void {
    const listeners = this.registrosDe(nombre, "tras-commit");
    if (listeners.length === 0) return;

    afterCommit(tx, async () => {
      for (const { listener } of listeners) {
        try {
          await listener(payload, tx);
        } catch (err) {
          this.logger.error({ err, evento: nombre }, "Listener fallido tras el COMMIT");
        }
      }
    });
  }

  // Ejecuta los listeners dentro de la transacción. Un error se propaga y revierte la transacción entera.
  async emitInTransaction<E extends NombreEvento>(
    tx: pg.PoolClient,
    nombre: E,
    payload: EventosDeDominio[E],
  ): Promise<void> {
    for (const { listener } of this.registrosDe(nombre, "en-transaccion")) {
      await listener(payload, tx);
    }
  }

  private registrar(nombre: NombreEvento, registro: Registro): void {
    const actuales = this.registros.get(nombre) ?? [];
    this.registros.set(nombre, [...actuales, registro]);
  }

  private registrosDe(nombre: NombreEvento, modo: Registro["modo"]): Registro[] {
    return (this.registros.get(nombre) ?? []).filter((registro) => registro.modo === modo);
  }
}
