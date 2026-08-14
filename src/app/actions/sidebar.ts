"use server";

import { cookies } from "next/headers";

import { isSidebarMode, SIDEBAR_COOKIE, type SidebarMode } from "@/lib/sidebar";

export async function setSidebarMode(mode: SidebarMode) {
  if (!isSidebarMode(mode)) return;

  const store = await cookies();
  store.set(SIDEBAR_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
}
