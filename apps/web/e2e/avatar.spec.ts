import { expect, test } from "@playwright/test";
import { BASE, iniciarSesionUI, registrarPorApi, sufijo, CONTRASENA } from "./helpers";

// PNG de 1×1 píxel: la API lo convierte a WebP de 256×256 al subirlo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// Foto de perfil (FE-2.1 con next/image): la imagen subida se muestra cargada, y se puede quitar.
test("subir y quitar la foto de perfil", async ({ browser }) => {
  const usuario = `foto_e2e_${sufijo()}`;
  const contexto = await browser.newContext();
  await registrarPorApi(contexto.request, usuario, `${usuario}@test.cinematch.local`);
  const pagina = await contexto.newPage();
  await iniciarSesionUI(pagina, `${usuario}@test.cinematch.local`, CONTRASENA);
  await expect(pagina).toHaveURL(`${BASE}/`);

  await pagina.goto(`${BASE}/perfil`);
  await pagina
    .locator('input[type="file"]')
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await pagina.getByRole("button", { name: "Subir foto" }).click();
  await expect(pagina.getByText("Foto actualizada.")).toBeVisible();

  const imagen = pagina.getByRole("img", { name: `Foto de ${usuario}` }).first();
  await expect
    .poll(() => imagen.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

  await pagina.getByRole("button", { name: "Quitar foto" }).click();
  await expect(pagina.getByText("Foto quitada.")).toBeVisible();
  await contexto.close();
});
