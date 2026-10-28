import { Router, type Request } from "express";
import type pg from "pg";
import { z } from "zod";
import { NotFoundError, UnauthorizedError } from "../../lib/errors.js";
import { registroOpenApi } from "../../lib/openapi.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { ServicioAuth } from "../auth/auth.service.js";
import type { ServicioBiblioteca } from "../biblioteca/biblioteca.servicio.js";
import type { ServicioConsultaResenas } from "../resenas/resenas.consulta.js";

const ParamsUsuarioSchema = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registrar({
  metodo: "get",
  ruta: "/api/users/{id}/profile",
  resumen:
    "Perfil de otro usuario: público para cualquiera; biblioteca y reseñas restringidas para amigos",
  respuestas: {
    200: { descripcion: "Perfil con relación con la sesión." },
    401: { descripcion: "No hay sesión vigente.", esquema: "ErrorResponse" },
    404: { descripcion: "El usuario no existe o está eliminado.", esquema: "ErrorResponse" },
  },
});

export type DependenciasPerfilPublico = {
  pool: pg.Pool;
  resenas: ServicioConsultaResenas;
  biblioteca: ServicioBiblioteca;
  amigos: { sonAmigos(a: number, b: number): Promise<boolean> };
  servicioAuth: ServicioAuth;
};

// Estado de la relación para mostrar el botón de solicitud (mismo criterio que la búsqueda de usuarios).
// Devuelve también el id de la amistad (null sin relación activa) para aceptar o cancelar desde el perfil.
async function relacionCon(
  pool: pg.Pool,
  yo: number,
  otro: number,
): Promise<{ relacion: string; amistadId: number | null }> {
  const { rows } = await pool.query<{ id: number; estado: string; solicitante_id: number }>(
    `SELECT id, estado, solicitante_id FROM amistad
      WHERE LEAST(solicitante_id, receptor_id) = LEAST($1::int, $2::int)
        AND GREATEST(solicitante_id, receptor_id) = GREATEST($1::int, $2::int)`,
    [yo, otro],
  );
  const fila = rows[0];
  if (!fila || fila.estado === "rechazada") return { relacion: "ninguna", amistadId: null };
  const relacion =
    fila.estado === "aceptada"
      ? "amigos"
      : fila.solicitante_id === yo
        ? "pendienteEnviada"
        : "pendienteRecibida";
  return { relacion, amistadId: fila.id };
}

export function createPerfilPublicoRouter(deps: DependenciasPerfilPublico): Router {
  const { pool, resenas, biblioteca, amigos, servicioAuth } = deps;
  const router = Router();
  const autenticado = requireAuth(servicioAuth);

  router.get(
    "/users/:id/profile",
    autenticado,
    validate({ params: ParamsUsuarioSchema }),
    async (req: Request, res) => {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const { id } = res.locals.input.params as z.infer<typeof ParamsUsuarioSchema>;
      const yo = req.user.id;

      const { rows } = await pool.query<{
        id: number;
        username: string;
        nombre: string;
        avatar_url: string | null;
        bio: string | null;
      }>(
        "SELECT id, username, nombre, avatar_url, bio FROM usuario WHERE id = $1 AND eliminado_en IS NULL",
        [id],
      );
      const usuario = rows[0];
      if (!usuario) {
        throw new NotFoundError("El usuario no existe.");
      }

      const esPropio = id === yo;
      const esAmigo = !esPropio && (await amigos.sonAmigos(yo, id));
      // Las reseñas siguen la regla de visibilidad (BE-9.4): el propio y los amigos ven lo que corresponde.
      const resenasPagina = await resenas.resenasDeUsuario(id, yo, { page: 1, pageSize: 20 });
      // La biblioteca solo la ven el dueño y los amigos (BE-8.4).
      const bibliotecaPagina =
        esPropio || esAmigo
          ? await biblioteca.listar(id, {
              orden: "fecha",
              dir: "desc",
              page: 1,
              pageSize: 20,
              generoIds: undefined,
            })
          : null;

      const relacion = esPropio
        ? { relacion: "ninguna", amistadId: null }
        : await relacionCon(pool, yo, id);
      res.json({
        usuario: {
          id: usuario.id,
          username: usuario.username,
          nombre: usuario.nombre,
          avatarUrl: usuario.avatar_url,
          bio: usuario.bio,
        },
        esPropio,
        relacion: relacion.relacion,
        amistadId: relacion.amistadId,
        resenas: resenasPagina,
        biblioteca: bibliotecaPagina,
      });
    },
  );

  return router;
}
