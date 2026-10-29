import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { BASE, iniciarSesionPorApi, registrarPorApi, sufijo } from "./helpers";

// Accesibilidad (FE-11.2): axe (WCAG 2 A y AA) sin violaciones en las pantallas principales.
const ETIQUETAS = ["wcag2a", "wcag2aa", "wcag21aa"];
const PUBLICAS = ["/login", "/registro", "/recuperar"];
const PRIVADAS = ["/", "/catalogo", "/biblioteca", "/amigos", "/notificaciones", "/perfil"];

async function auditar(pagina: import("@playwright/test").Page, ruta: string) {
  await pagina.goto(BASE + ruta);
  await pagina.waitForLoadState("load");
  const resultado = await new AxeBuilder({ page: pagina }).withTags(ETIQUETAS).analyze();
  expect(
    resultado.violations.map((v) => `${v.id} (${v.nodes.length})`),
    `violaciones en ${ruta}`,
  ).toEqual([]);
}

test("páginas públicas sin violaciones de accesibilidad", async ({ browser }) => {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();
  for (const ruta of PUBLICAS) {
    await auditar(pagina, ruta);
  }
  await contexto.close();
});

test("páginas de usuario sin violaciones de accesibilidad", async ({ browser }) => {
  const usuario = `a11y_e2e_${sufijo()}`;
  const contexto = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await registrarPorApi(contexto.request, usuario, `${usuario}@test.cinematch.local`);
  await iniciarSesionPorApi(contexto.request, `${usuario}@test.cinematch.local`);
  const pagina = await contexto.newPage();
  for (const ruta of PRIVADAS) {
    await auditar(pagina, ruta);
    const desborde = await pagina.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde, `desborde horizontal en ${ruta} a 360 px`).toBe(0);
  }
  await contexto.close();
});
