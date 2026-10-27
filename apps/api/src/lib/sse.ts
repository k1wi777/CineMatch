import type { Response } from "express";

// Registro de conexiones SSE abiertas. Lo usará BE-5.3; aquí solo existe para
// que el apagado ordenado ya las cierre.
const openConnections = new Set<Response>();

export function trackSseConnection(res: Response): void {
  openConnections.add(res);
  res.on("close", () => openConnections.delete(res));
}

export function closeSseConnections(): void {
  for (const res of openConnections) {
    res.end();
  }
  openConnections.clear();
}
