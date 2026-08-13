"use server";

import { cookies } from "next/headers";

import { isTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

/**
 * Guarda la preferencia de tema.
 *
 * Por ahora solo escribe la cookie. Cuando exista la sesión, esta misma acción
 * va a escribir además `profiles.theme`, que es la fuente de verdad; la cookie
 * seguirá siendo el espejo que permite pintar el primer render sin destello.
 */
export async function setTheme(theme: Theme) {
  if (!isTheme(theme)) return;

  const store = await cookies();

  store.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    // No es una cookie de sesión ni lleva nada sensible: es una preferencia
    // visual. Se deja legible para poder aplicarla también desde el cliente.
    httpOnly: false,
  });
}
