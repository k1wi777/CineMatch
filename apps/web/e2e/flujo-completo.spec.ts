import { expect, test } from "@playwright/test";
import {
  BASE,
  CONTRASENA,
  aceptarSolicitudDe,
  calificarCuatro,
  iniciarSesionPorApi,
  iniciarSesionUI,
  registrarPorApi,
  sufijo,
} from "./helpers";

// Flujo completo de FE-11.3: registro → catálogo → reseña → recomendar → recibir → completar → notificación.
test("registro, reseña, recomendación, completado y notificación", async ({ browser }) => {
  const s = sufijo();
  const ana = `ana_e2e_${s}`;
  const correoAna = `${ana}@test.cinematch.local`;
  const beto = `beto_e2e_${s}`;
  const correoBeto = `${beto}@test.cinematch.local`;

  const contextoAna = await browser.newContext();
  const contextoBeto = await browser.newContext();
  const paginaAna = await contextoAna.newPage();
  const paginaBeto = await contextoBeto.newPage();

  // Beto se crea por API (preparación). Ana se registra por la interfaz.
  await registrarPorApi(contextoBeto.request, beto, correoBeto);
  await paginaAna.goto(`${BASE}/registro`);
  await paginaAna.getByLabel("Nombre", { exact: true }).fill(ana);
  await paginaAna.getByLabel("Nombre de usuario").fill(ana);
  await paginaAna.getByLabel("Correo electrónico").fill(correoAna);
  await paginaAna.getByLabel("Contraseña", { exact: true }).fill(CONTRASENA);
  await paginaAna.getByLabel(/Autorizo a CineMatch/).check();
  await paginaAna.getByRole("button", { name: "Continuar" }).click();
  for (const genero of ["Drama", "Comedia", "Acción"]) {
    await paginaAna.getByLabel(genero, { exact: true }).check();
  }
  await paginaAna.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(paginaAna.getByText("Cuenta creada. Ya puedes iniciar sesión.")).toBeVisible();

  // Inicio de sesión de Ana y elección de un título del catálogo.
  await iniciarSesionUI(paginaAna, correoAna);
  await expect(paginaAna).toHaveURL(`${BASE}/`);
  // Filtro por Drama (id 1), que Ana y Beto tienen en común: así la recomendación no queda fuera de intereses.
  await paginaAna.goto(`${BASE}/catalogo?generos=1`);
  await paginaAna.locator('main a[href^="/catalogo/"]').first().click();
  await expect(paginaAna).toHaveURL(/\/catalogo\/\d+$/);
  const tituloId = Number(new URL(paginaAna.url()).pathname.split("/").pop());
  const nombreTitulo = (await paginaAna.getByRole("heading", { level: 1 }).innerText()).trim();

  // Reseña de Ana.
  await calificarCuatro(paginaAna);
  await paginaAna
    .getByLabel("Comentario (opcional)")
    .fill("Muy recomendable para el fin de semana");
  await paginaAna.getByRole("button", { name: "Publicar reseña" }).click();
  await expect(paginaAna.getByText("Reseña guardada.")).toBeVisible();

  // Amistad: Ana busca a Beto y envía la solicitud; Beto la acepta.
  await paginaAna.goto(`${BASE}/amigos/buscar`);
  await paginaAna.getByLabel("Nombre de usuario").fill(beto);
  const fila = paginaAna.getByRole("listitem").filter({ hasText: `@${beto}` });
  await fila.getByRole("button", { name: "Agregar" }).click();
  await expect(fila.getByText("Solicitud enviada")).toBeVisible();
  await iniciarSesionPorApi(contextoBeto.request, correoBeto);
  await aceptarSolicitudDe(contextoBeto.request, ana);

  // Ana recomienda el título a Beto.
  await paginaAna.goto(`${BASE}/catalogo/${tituloId}/recomendar`);
  await paginaAna
    .locator("label", { hasText: `@${beto}` })
    .getByRole("radio")
    .check();
  await paginaAna.getByRole("button", { name: "Enviar recomendación" }).click();
  await expect(paginaAna.getByText(`Recomendación enviada a @${beto}.`)).toBeVisible();

  // Beto recibe la recomendación y abre el detalle (pasa a «abierta»).
  await iniciarSesionUI(paginaBeto, correoBeto);
  await expect(paginaBeto).toHaveURL(`${BASE}/`);
  await paginaBeto.goto(`${BASE}/recomendaciones`);
  await paginaBeto.getByRole("link", { name: nombreTitulo, exact: true }).first().click();
  await expect(paginaBeto.getByText(`Recomendada por @${ana}`)).toBeVisible();

  // Beto completa la recomendación al reseñar el título.
  await paginaBeto.goto(`${BASE}/catalogo/${tituloId}`);
  await calificarCuatro(paginaBeto);
  await paginaBeto.getByRole("button", { name: "Publicar reseña" }).click();
  await expect(paginaBeto.getByText("Reseña guardada.")).toBeVisible();

  // Ana recibe la notificación de que su recomendación se completó.
  await paginaAna.goto(`${BASE}/notificaciones`);
  await expect(
    paginaAna.getByText(`@${beto} completó tu recomendación.`, { exact: true }),
  ).toBeVisible({
    timeout: 20_000,
  });

  await contextoAna.close();
  await contextoBeto.close();
});
