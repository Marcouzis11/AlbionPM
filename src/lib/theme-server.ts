import "server-only";

import { cookies } from "next/headers";

import { DEFAULT_THEME, isTheme, THEME_COOKIE, type Theme } from "./theme";

/**
 * Lectura del tema desde la cookie, para Server Components.
 *
 * Está separado de `theme.ts` porque `next/headers` no existe en el navegador,
 * y el selector de tema —que sí corre ahí— necesita las utilidades comunes.
 * `server-only` hace que ese error salte en tiempo de compilación con un
 * mensaje claro, en vez de romper en producción.
 */
export async function readTheme(): Promise<Theme> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}
