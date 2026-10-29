import { expect, test } from "@playwright/test";
import { BASE, iniciarSesionPorApi, iniciarSesionUI, registrarPorApi, sufijo } from "./helpers";

// Moderación (FE-11.3): ocultar y restablecer una reseña desde el panel de administración.
// Necesita un administrador de pruebas. Sin sus credenciales, la prueba se omite.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const CABECERAS = { Origin: BASE, "Content-Type": "application/json" };

test.describe("moderación de reseñas", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Define E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD con un administrador de pruebas.",
  );

  test("ocultar y restablecer una reseña", async ({ browser }) => {
    const s = sufijo();
    const autor = `mod_e2e_${s}`;
    const correo = `${autor}@test.cinematch.local`;

    const contextoAutor = await browser.newContext();
    const contextoAdmin = await browser.newContext();

    // El autor de la reseña se prepara por API.
    await registrarPorApi(contextoAutor.request, autor, correo);
    await iniciarSesionPorApi(contextoAutor.request, correo);
    const catalogo = await contextoAutor.request.get(`${BASE}/api/catalog?pageSize=1`);
    const { items } = (await catalogo.json()) as { items: { id: number }[] };
    const res = await contextoAutor.request.put(`${BASE}/api/titles/${items[0]!.id}/review`, {
      headers: CABECERAS,
      data: { calificacion: 3, comentario: "Reseña de prueba E2E de moderación" },
    });
    expect([200, 201]).toContain(res.status());

    // El administrador oculta la reseña desde la interfaz y luego la restablece.
    const admin = await contextoAdmin.newPage();
    await iniciarSesionUI(admin, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    // Un administrador entra al panel: esperar a esa redirección asegura que la sesión ya existe.
    await expect(admin).toHaveURL(`${BASE}/admin`);
    await admin.goto(`${BASE}/admin/moderacion`);
    await admin.getByLabel("Autor (usuario)").fill(autor);
    const fila = admin.getByRole("listitem").filter({ hasText: `@${autor}` });
    await expect(fila).toBeVisible();

    await fila.getByRole("button", { name: "Ocultar", exact: true }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Ocultar", exact: true }).click();
    await expect(fila.getByText("Oculta", { exact: true })).toBeVisible();

    await fila.getByRole("button", { name: "Restablecer", exact: true }).click();
    await admin
      .getByRole("dialog")
      .getByRole("button", { name: "Restablecer", exact: true })
      .click();
    await expect(fila.getByText("Visible", { exact: true })).toBeVisible();

    await contextoAutor.close();
    await contextoAdmin.close();
  });
});
