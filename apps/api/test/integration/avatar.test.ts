import { mkdtemp, access, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type pg from "pg";
import request from "supertest";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { createTestPool, resetDatabase } from "../helpers/database.js";
import { crearUsuarioConContrasena } from "../helpers/fixtures.js";
import { TAMANO_MAXIMO_AVATAR } from "../../src/modules/usuarios/avatar.routes.js";

const ORIGEN = "http://localhost:3000";
const CORREO_A = "avatar.a@cinematch.test";
const CORREO_B = "avatar.b@cinematch.test";
const CONTRASENA = "Clave1234";
const PATRON_ARCHIVO = /^\d+-[0-9a-f]{32}\.webp$/;

function login(app: ReturnType<typeof buildTestApp>, correo: string) {
  return request(app)
    .post("/api/auth/login")
    .set("Origin", ORIGEN)
    .send({ correo, contrasena: CONTRASENA });
}

function cookieDe(res: request.Response): string {
  return String(res.headers["set-cookie"]).split(";")[0] ?? "";
}

// Imagen real con metadatos EXIF (copyright y GPS), para comprobar que no sobreviven.
async function jpegConExif(ancho = 600, alto = 400): Promise<Buffer> {
  return sharp({
    create: { width: ancho, height: alto, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .jpeg()
    .withExif({ IFD0: { Copyright: "datos privados", Artist: "Persona real" } })
    .toBuffer();
}

async function existe(ruta: string): Promise<boolean> {
  return access(ruta).then(
    () => true,
    () => false,
  );
}

describe("avatar local (BE-4.4)", () => {
  let pool: pg.Pool;
  let directorio: string;

  beforeAll(async () => {
    pool = createTestPool();
    directorio = await mkdtemp(join(tmpdir(), "cinematch-avatares-"));
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    await rm(directorio, { recursive: true, force: true });
  });

  afterAll(async () => {
    await pool.end();
    await rm(directorio, { recursive: true, force: true });
  });

  describe("POST /api/users/me/avatar", () => {
    it("guarda una imagen válida como WebP 256×256 sin metadatos EXIF", async () => {
      await crearUsuarioConContrasena(pool, "avatar_valido", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("avatar", await jpegConExif(), { filename: "foto.jpg", contentType: "image/jpeg" });

      expect(res.status).toBe(200);
      const archivo = res.body.avatarUrl.replace("/uploads/avatars/", "");
      expect(archivo).toMatch(PATRON_ARCHIVO);
      // Se lee como buffer: sharp por ruta retiene el archivo abierto y Windows no permite borrarlo luego.
      const metadatos = await sharp(await readFile(join(directorio, archivo))).metadata();
      expect(metadatos.format).toBe("webp");
      expect(metadatos.width).toBe(256);
      expect(metadatos.height).toBe(256);
      expect(metadatos.exif).toBeUndefined();
    });

    it("acepta PNG además de JPEG", async () => {
      await crearUsuarioConContrasena(pool, "avatar_png", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));
      const png = await sharp({
        create: { width: 100, height: 100, channels: 3, background: "#00f" },
      })
        .png()
        .toBuffer();

      const res = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("avatar", png, { filename: "foto.png", contentType: "image/png" });

      expect(res.status).toBe(200);
    });

    it("decide el tipo por la firma, no por la extensión ni el Content-Type (415)", async () => {
      await crearUsuarioConContrasena(pool, "avatar_falso", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("avatar", Buffer.from("<html><script>alert(1)</script></html>"), {
          filename: "foto.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    });

    it("rechaza un GIF aunque sea una imagen real (415)", async () => {
      await crearUsuarioConContrasena(pool, "avatar_gif", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));
      const gif = Buffer.from(
        "GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
        "binary",
      );

      const res = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("avatar", gif, { filename: "foto.gif", contentType: "image/gif" });

      expect(res.status).toBe(415);
    });

    it("una imagen con firma válida pero contenido corrupto responde 422 en el campo avatar", async () => {
      await crearUsuarioConContrasena(pool, "avatar_corrupto", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));
      const corrupta = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);

      const res = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("avatar", corrupta, { filename: "rota.jpg", contentType: "image/jpeg" });

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("avatar");
    });

    it("rechaza un archivo mayor de 2 MB con 413", async () => {
      await crearUsuarioConContrasena(pool, "avatar_grande", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));
      const grande = Buffer.alloc(TAMANO_MAXIMO_AVATAR + 1, 0);
      grande.set([0xff, 0xd8, 0xff], 0);

      const res = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("avatar", grande, { filename: "grande.jpg", contentType: "image/jpeg" });

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
      expect(await readdir(directorio).catch(() => [])).toHaveLength(0);
    });

    it("sin el campo avatar responde 422", async () => {
      await crearUsuarioConContrasena(pool, "avatar_sin_campo", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("otro", await jpegConExif(), { filename: "foto.jpg", contentType: "image/jpeg" });

      expect(res.status).toBe(422);
      expect(res.body.error.fields).toHaveProperty("avatar");
    });

    it("exige sesión antes de leer el archivo (401)", async () => {
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });

      const res = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .attach("avatar", await jpegConExif(), { filename: "foto.jpg", contentType: "image/jpeg" });

      expect(res.status).toBe(401);
    });

    it("al reemplazar el avatar borra el archivo anterior", async () => {
      await crearUsuarioConContrasena(pool, "avatar_reemplazo", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));

      const primera = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("avatar", await jpegConExif(), { filename: "foto.jpg", contentType: "image/jpeg" });
      const archivoAnterior = primera.body.avatarUrl.replace("/uploads/avatars/", "");
      const segunda = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("avatar", await jpegConExif(300, 200), {
          filename: "otra.jpg",
          contentType: "image/jpeg",
        });
      const archivoNuevo = segunda.body.avatarUrl.replace("/uploads/avatars/", "");

      expect(archivoNuevo).not.toBe(archivoAnterior);
      expect(await existe(join(directorio, archivoAnterior))).toBe(false);
      expect(await existe(join(directorio, archivoNuevo))).toBe(true);
    });
  });

  describe("DELETE /api/users/me/avatar", () => {
    it("quita el avatar, borra el archivo y deja el perfil sin avatar", async () => {
      await crearUsuarioConContrasena(pool, "avatar_borrado", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));
      const subida = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("avatar", await jpegConExif(), { filename: "foto.jpg", contentType: "image/jpeg" });
      const archivo = subida.body.avatarUrl.replace("/uploads/avatars/", "");

      const borrado = await request(app)
        .delete("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion);
      const perfil = await request(app).get("/api/users/me").set("Cookie", sesion);

      expect(borrado.status).toBe(204);
      expect(await existe(join(directorio, archivo))).toBe(false);
      expect(perfil.body.avatarUrl).toBeNull();
    });

    it("sin avatar previo también responde 204", async () => {
      await crearUsuarioConContrasena(pool, "avatar_vacio", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));

      const res = await request(app)
        .delete("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion);

      expect(res.status).toBe(204);
    });

    it("no toca el avatar de otro usuario", async () => {
      await crearUsuarioConContrasena(pool, "avatar_dueno", CORREO_A, CONTRASENA);
      await crearUsuarioConContrasena(pool, "avatar_ajeno", CORREO_B, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesionB = cookieDe(await login(app, CORREO_B));
      const subida = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesionB)
        .attach("avatar", await jpegConExif(), { filename: "foto.jpg", contentType: "image/jpeg" });
      const archivoB = subida.body.avatarUrl.replace("/uploads/avatars/", "");

      const sesionA = cookieDe(await login(app, CORREO_A));
      await request(app)
        .delete("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesionA);

      expect(await existe(join(directorio, archivoB))).toBe(true);
    });
  });

  describe("GET /uploads/avatars/<archivo>", () => {
    it("sirve el avatar con nosniff y caché larga", async () => {
      await crearUsuarioConContrasena(pool, "avatar_servido", CORREO_A, CONTRASENA);
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });
      const sesion = cookieDe(await login(app, CORREO_A));
      const subida = await request(app)
        .post("/api/users/me/avatar")
        .set("Origin", ORIGEN)
        .set("Cookie", sesion)
        .attach("avatar", await jpegConExif(), { filename: "foto.jpg", contentType: "image/jpeg" });

      const res = await request(app).get(subida.body.avatarUrl);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("image/webp");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["cache-control"]).toContain("max-age=31536000");
      expect(res.headers["cache-control"]).toContain("immutable");
    });

    it("un archivo inexistente responde 404 sin exponer la carpeta", async () => {
      const app = buildTestApp(pool, undefined, false, { directorioAvatares: directorio });

      const res = await request(app).get(
        "/uploads/avatars/1-00000000000000000000000000000000.webp",
      );

      expect(res.status).toBe(404);
    });
  });
});
