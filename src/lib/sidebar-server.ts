import "server-only";

import { cookies } from "next/headers";

import { DEFAULT_SIDEBAR, isSidebarMode, SIDEBAR_COOKIE, type SidebarMode } from "./sidebar";

/** Lee el modo de la barra lateral para poder pintarla ya con su ancho. */
export async function readSidebarMode(): Promise<SidebarMode> {
  const store = await cookies();
  const value = store.get(SIDEBAR_COOKIE)?.value;
  return isSidebarMode(value) ? value : DEFAULT_SIDEBAR;
}
