/**
 * Tema de la interfaz — parte compartida entre servidor y cliente.
 *
 * Este archivo no importa nada de `next/headers` a propósito: lo usa también
 * el selector de tema, que corre en el navegador. La lectura de la cookie vive
 * en `theme-server.ts`.
 *
 * La fuente de verdad de la preferencia es `profiles.theme` en la base, para
 * que acompañe al usuario entre dispositivos. Pero la base no se puede
 * consultar antes de pintar el primer HTML sin sumar latencia a cada carga,
 * así que el valor se espeja en una cookie que el servidor lee de inmediato.
 *
 * Sin ese espejo se ve un destello blanco en cada carga, antes de que el
 * JavaScript aplique el modo oscuro. Es el error más común de esta
 * funcionalidad y la razón de que exista este mecanismo.
 */

export const THEME_COOKIE = "albionpm-theme";

/** `system` sigue la configuración del sistema operativo. */
export type Theme = "dark" | "light" | "system";

/**
 * Modo oscuro por defecto: es lo que espera quien viene de jugar Albion, y
 * evita deslumbrar a alguien que abre la web de noche antes de una CTA.
 */
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light" || value === "system";
}

/**
 * Atributo `data-theme` del `<html>`.
 *
 * Con `system` se devuelve `undefined` a propósito: sin el atributo, la regla
 * `prefers-color-scheme` del CSS es la que decide. Poner `data-theme="system"`
 * rompería ese mecanismo, porque el selector `:not([data-theme])` dejaría de
 * coincidir y el modo oscuro del sistema no se aplicaría nunca.
 */
export function themeAttribute(theme: Theme): "dark" | "light" | undefined {
  return theme === "system" ? undefined : theme;
}
