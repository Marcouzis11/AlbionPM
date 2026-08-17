"use client";

import { useSyncExternalStore } from "react";

import { ultimaNovedad } from "@/lib/novedades";

/**
 * Qué novedad fue la última que leíste.
 *
 * Vive en el navegador y no en la base: es una marca de esta computadora y de
 * este rato, no un dato del gremio. Que te siga a otra máquina sería raro y
 * costaría una tabla.
 *
 * Se lee con `useSyncExternalStore` en vez de un efecto por un motivo concreto:
 * el servidor no tiene `localStorage`, así que pinta «sin novedades» y el
 * cliente corrige apenas monta. Leerlo durante el render, sin más, haría que
 * las dos versiones no coincidan y React lo rechaza.
 */

const CLAVE = "albionpm-novedades-leidas";

const oyentes = new Set<() => void>();

function avisar() {
  for (const oyente of oyentes) oyente();
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  // También cuando se lee desde otra pestaña.
  window.addEventListener("storage", oyente);
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", oyente);
  };
}

function leer(): string {
  try {
    return window.localStorage.getItem(CLAVE) ?? "";
  } catch {
    // Modo privado o almacenamiento bloqueado: no es motivo para romper la
    // barra, apenas para mostrar el punto siempre.
    return "";
  }
}

/** ¿Hay algo que todavía no viste? */
export function useHayNovedades(): boolean {
  const leida = useSyncExternalStore(suscribir, leer, () => ultimaNovedad());
  return leida !== ultimaNovedad();
}

/** Marca todo como leído. Se llama al abrir la pantalla. */
export function marcarLeidas() {
  try {
    window.localStorage.setItem(CLAVE, ultimaNovedad());
  } catch {
    return;
  }
  avisar();
}
