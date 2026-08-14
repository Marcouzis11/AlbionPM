/**
 * Estado de la barra lateral: fina o amplia.
 *
 * Se espeja en una cookie por el mismo motivo que el tema: el servidor tiene
 * que saber el ancho ANTES de pintar. Si se decidiera en el cliente, cada
 * carga mostraría la barra amplia y después la vería encogerse de golpe.
 */

export const SIDEBAR_COOKIE = "albionpm-sidebar";

export type SidebarMode = "wide" | "thin";

export const DEFAULT_SIDEBAR: SidebarMode = "wide";

export function isSidebarMode(value: unknown): value is SidebarMode {
  return value === "wide" || value === "thin";
}

/**
 * Anchos de los dos modos.
 *
 * El fino se calcula desde el contenido: 40 px de ícono más el aire de los
 * lados. Más angosto que eso, los íconos quedan pegados al borde y el objetivo
 * de click se vuelve incómodo en pantallas táctiles.
 */
export const SIDEBAR_WIDTH: Record<SidebarMode, string> = {
  wide: "13.5rem",
  thin: "3.75rem",
};
