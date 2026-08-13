import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para Server Components, Server Actions y route handlers.
 *
 * Cada petición crea el suyo: la sesión vive en las cookies de esa petición y
 * un cliente compartido entre peticiones mezclaría sesiones de distintos
 * usuarios. Nunca guardar el resultado en una variable de módulo.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Los Server Components no pueden escribir cookies. No es un
            // problema: la renovación de la sesión la hace `proxy.ts`, que sí
            // puede, y corre antes de que se rendericen las páginas.
          }
        },
      },
    },
  );
}
