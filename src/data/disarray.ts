/**
 * Curva de Disarray.
 *
 * ⚠ ESTE ES EL ÚNICO ARCHIVO QUE HAY QUE TOCAR cuando Sandbox Interactive
 * cambie el balance. Ninguna otra parte del código conoce estos números.
 *
 * ── Lo que hay que entender antes de confiar en esto ────────────────────────
 *
 * 1. El Disarray NO depende de tu composición, sino de cuántos jugadores de tu
 *    alianza hay en el cluster, INCLUIDOS los que están en cola para entrar.
 *    Tu comp es un piso, no el total.
 *
 * 2. El debuff es RELATIVO: solo penaliza al atacar a alguien con Disarray
 *    menor. Contra un rival igual o mayor, no tiene efecto.
 *
 * 3. La tabla exacta NO está documentada de forma confiable en fuentes
 *    públicas, y SBI la cambió varias veces entre parches.
 *
 * Por eso la interfaz habla de "Disarray estimado" y explica el supuesto.
 * Prometer precisión acá sería mentir.
 *
 * ── Fuentes ─────────────────────────────────────────────────────────────────
 *
 * - Wiki oficial: arranca a partir de 25 jugadores de la misma alianza en el
 *   cluster; afecta daño extra contra jugadores y duración de control.
 * - Declaraciones de los desarrolladores: alrededor de 100 jugadores el valor
 *   ronda el 25%.
 *
 * De ahí sale la aproximación lineal de abajo: ~1 punto porcentual cada 3
 * jugadores por encima del umbral. Es una aproximación, no la fórmula del
 * juego.
 *
 * Última revisión: agosto de 2026.
 */

/** Por debajo de esto no hay Disarray. */
export const UMBRAL = 25;

/** Cuántos jugadores hacen falta para sumar un punto porcentual. */
const JUGADORES_POR_PUNTO = 3;

/** Techo observado. Por encima, el valor deja de crecer de forma apreciable. */
export const MAXIMO = 40;

/** Nivel de Disarray, en puntos porcentuales, para una cantidad de jugadores. */
export function nivelDisarray(jugadores: number): number {
  if (jugadores <= UMBRAL) return 0;
  const nivel = (jugadores - UMBRAL) / JUGADORES_POR_PUNTO;
  return Math.min(MAXIMO, Math.round(nivel * 10) / 10);
}

/**
 * Modificador de daño al atacar a un grupo con otro nivel de Disarray.
 *
 * `(1 − propio/100) / (1 − rival/100)`, según la explicación de los
 * desarrolladores. Devuelve 1 cuando no hay penalización, y menos de 1 cuando
 * la hay. Contra un rival con Disarray igual o mayor, nunca penaliza.
 */
export function modificadorRelativo(propio: number, rival: number): number {
  if (propio <= rival) return 1;
  return (1 - propio / 100) / (1 - rival / 100);
}

/** Lo mismo, expresado como pérdida porcentual de daño. */
export function perdidaPorcentual(propio: number, rival: number): number {
  return Math.round((1 - modificadorRelativo(propio, rival)) * 1000) / 10;
}
