import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const BASE = "http://localhost:3000";
export const CONTRASENA = "Demo1234";
const CABECERAS = { Origin: BASE, "Content-Type": "application/json" };

// Sufijo corto y único por ejecución: cada prueba crea sus propios usuarios.
export function sufijo(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function registrarPorApi(request: APIRequestContext, usuario: string, correo: string) {
  const res = await request.post(`${BASE}/api/auth/register`, {
    headers: CABECERAS,
    data: {
      nombre: usuario,
      username: usuario,
      correo,
      contrasena: CONTRASENA,
      aceptaDatos: true,
      generoIds: [1, 2, 3],
    },
  });
  expect(res.status(), "registro por API").toBe(201);
}

export async function iniciarSesionPorApi(
  request: APIRequestContext,
  correo: string,
  contrasena = CONTRASENA,
) {
  const res = await request.post(`${BASE}/api/auth/login`, {
    headers: CABECERAS,
    data: { correo, contrasena },
  });
  expect(res.status(), "inicio de sesión por API").toBe(200);
}

// El receptor acepta la solicitud de un usuario. Es preparación de la prueba, no parte del flujo.
export async function aceptarSolicitudDe(request: APIRequestContext, usernameEmisor: string) {
  const lista = await request.get(`${BASE}/api/friends/requests/received?page=1`);
  const { items } = (await lista.json()) as {
    items: { id: number; usuario: { username: string } }[];
  };
  const solicitud = items.find((item) => item.usuario.username === usernameEmisor);
  expect(solicitud, "solicitud pendiente").toBeDefined();
  const res = await request.post(`${BASE}/api/friends/requests/${solicitud!.id}/accept`, {
    headers: CABECERAS,
  });
  expect(res.status()).toBe(200);
}

export async function iniciarSesionUI(page: Page, correo: string, contrasena = CONTRASENA) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Correo electrónico").fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Entrar" }).click();
}

// Calificación con el teclado: End (5) y dos flechas a la izquierda (4).
export async function calificarCuatro(page: Page) {
  const control = page.getByRole("slider", { name: "Tu calificación" });
  await control.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(control).toHaveAttribute("aria-valuenow", "4");
}
