import pino from "pino";
import type pg from "pg";
import { createApp } from "../../src/app.js";
import type { ReglasDeNegocio } from "../../src/config/business-rules.js";
import type { OpcionesDeSeguridad } from "../../src/config/security.js";
import type { ServicioCorreo } from "../../src/lib/correo.js";
import type { EventBus } from "../../src/lib/events.js";
import type { MovieProvider } from "../../src/modules/catalogo/proveedor/movie-provider.js";
import type {
  HubNotificaciones,
  IntervalosStream,
} from "../../src/modules/notificaciones/notificaciones.stream.js";

const silentLogger = pino({ level: "silent" });

// Opciones de seguridad para pruebas: origen conocido y límites altos para no estorbar a cada test.
export const SEGURIDAD_DE_PRUEBA: OpcionesDeSeguridad = {
  webUrl: "http://localhost:3000",
  trustProxy: false,
  jsonLimite: "100kb",
  limites: {
    general: { ventanaMs: 60_000, max: 10_000 },
    auth: { ventanaMs: 60_000, max: 10_000 },
  },
};

// Reglas de negocio con sus valores por defecto (ERS).
export const REGLAS_DE_PRUEBA: ReglasDeNegocio = {
  TAG_MIN_REVIEWS: 3,
  COMMUNITY_MIN_RATINGS: 5,
  COMMUNITY_CACHE_TTL_MINUTES: 60,
  SESSION_IDLE_MINUTES: 30,
  SESSION_ABSOLUTE_DAYS: 7,
  SESSION_TOUCH_SECONDS: 60,
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_LOCK_MINUTES: 15,
  RESET_TOKEN_TTL_MINUTES: 60,
};

// Correo falso: guarda los envíos para que las pruebas lean el enlace de recuperación.
export function correoDePrueba(): ServicioCorreo & {
  enviados: { destino: string; enlace: string }[];
} {
  const enviados: { destino: string; enlace: string }[] = [];
  return {
    enviados,
    async enviarRecuperacion(destino, enlace) {
      enviados.push({ destino, enlace });
    },
  };
}

type OpcionesDePrueba = {
  produccion?: boolean;
  reloj?: () => Date;
  reglas?: ReglasDeNegocio;
  correo?: ServicioCorreo;
  directorioAvatares?: string;
  notificaciones?: HubNotificaciones;
  intervalosStream?: Partial<IntervalosStream>;
  eventos?: EventBus;
  proveedorCatalogo?: MovieProvider;
  cantidadSincronizacion?: number;
};

// Aplicación Express real, sin abrir puerto: Supertest la monta directamente.
export function buildTestApp(
  pool: pg.Pool,
  seguridad: OpcionesDeSeguridad = SEGURIDAD_DE_PRUEBA,
  documentacion = true,
  opciones: OpcionesDePrueba = {},
) {
  return createApp({
    pool,
    logger: silentLogger,
    seguridad,
    documentacion,
    reglas: opciones.reglas ?? REGLAS_DE_PRUEBA,
    produccion: opciones.produccion ?? false,
    reloj: opciones.reloj,
    correo: opciones.correo ?? correoDePrueba(),
    directorioAvatares: opciones.directorioAvatares,
    notificaciones: opciones.notificaciones,
    intervalosStream: opciones.intervalosStream,
    eventos: opciones.eventos,
    proveedorCatalogo: opciones.proveedorCatalogo,
    cantidadSincronizacion: opciones.cantidadSincronizacion,
  });
}
