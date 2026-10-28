import { NextResponse, type NextRequest } from "next/server";
import { decidirAcceso, NOMBRE_COOKIE_SESION } from "@/features/auth/rutas";

// Primera barrera: sin cookie de sesión, las rutas protegidas no se renderizan.
// No llama a la API: la validación de la sesión y del rol se hace en el cliente (GuardSesion).
export function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  const tieneCookie = request.cookies.has(NOMBRE_COOKIE_SESION);
  const decision = decidirAcceso(ruta, tieneCookie);

  if (decision.accion === "login") {
    const destino = new URL("/login", request.url);
    destino.searchParams.set("siguiente", decision.siguiente);
    return NextResponse.redirect(destino);
  }
  return NextResponse.next();
}

// No aplica a la API, a los archivos subidos ni a los recursos estáticos de Next.
export const config = {
  matcher: ["/((?!api|uploads|_next/static|_next/image|favicon.ico).*)"],
};
