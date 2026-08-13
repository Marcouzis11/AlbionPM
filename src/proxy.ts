import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renovación de la sesión de Supabase en cada petición.
 *
 * En Next.js 16 este archivo se llama `proxy.ts` y la función exportada,
 * `proxy`. La documentación de Supabase todavía dice `middleware.ts` con una
 * función `middleware`: copiado tal cual, no se ejecuta nada y la sesión se
 * cae sola a los pocos minutos.
 *
 * Corre antes de que se renderice cualquier página, que es el único momento
 * donde se pueden escribir las cookies del token renovado.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Sin credenciales configuradas simplemente no hay sesión que renovar.
  // Esto corre en TODAS las peticiones: si reventara acá, no se caería el
  // login, se caería el sitio entero, incluidas las composiciones públicas
  // que ni siquiera necesitan sesión.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // No quitar ni reemplazar por `getSession()`: `getUser()` es lo que valida
  // el token contra Supabase y dispara la renovación. `getSession()` se limita
  // a leer la cookie, y confiar en ella sin validar es lo que abre la puerta a
  // una sesión falsificada.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Todo salvo lo que no necesita sesión:
     * - archivos internos de Next
     * - el proxy de íconos, que es público y se llama cientos de veces por
     *   página: validar la sesión ahí sería puro costo sin ningún beneficio
     * - imágenes y fuentes
     */
    "/((?!_next/static|_next/image|api/icon|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
