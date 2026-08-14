import type { BuildItem } from "@/lib/items";

/**
 * Forma de una composición compartida, tal como la devuelve la función
 * `get_shared_composition` de la base.
 *
 * No hay identificadores acá a propósito: la vista pública no necesita saber
 * qué build es cuál en la base de datos, solo mostrarla. Menos cosas que
 * exponer, menos superficie que cuidar.
 */

export type SharedRole = {
  name: string;
  icon: string | null;
  color: string | null;
};

export type SharedBuild = {
  name: string;
  color: string | null;
  items: Record<string, BuildItem>;
  notes: string | null;
};

export type SharedSlot = {
  position: number;
  player_name: string | null;
  is_leader: boolean;
  notes: string | null;
  role: SharedRole | null;
  build: SharedBuild | null;
};

export type SharedGroup = {
  position: number;
  name: string | null;
  guild_name: string | null;
  slots: SharedSlot[];
};

export type ShareFormats = { link?: boolean; pdf?: boolean; png?: boolean };

export type SharedComposition = {
  name: string;
  description: string | null;
  event_at: string;
  event_tz: string;
  is_archived: boolean;
  share_formats: ShareFormats;
  groups: SharedGroup[];
};

/** Una persona encontrada, junto con el contexto que necesita para ubicarse. */
export type Encontrado = {
  slot: SharedSlot;
  group: SharedGroup;
  lider: SharedSlot | undefined;
  companeros: SharedSlot[];
};

/**
 * Busca a una persona por nombre.
 *
 * Tolerante a propósito: sin acentos, sin distinguir mayúsculas y por
 * coincidencia parcial. Los nombres de Albion se escriben mal siempre, y quien
 * busca está apurado, en el celular, cinco minutos antes de la CTA. Una
 * búsqueda exacta sería inútil justo cuando más falta hace.
 */
export function buscarJugador(
  composition: SharedComposition,
  consulta: string,
): Encontrado | null {
  const q = normalizar(consulta);
  if (!q) return null;

  for (const group of composition.groups) {
    for (const slot of group.slots) {
      const nombre = normalizar(slot.player_name ?? "");
      if (!nombre) continue;

      if (nombre === q || nombre.includes(q)) {
        return {
          slot,
          group,
          // El líder de SU grupo, no el del grupo 1. Es el error fácil de
          // cometer acá, y el que dejaría a alguien siguiendo al caller
          // equivocado en medio de una pelea.
          lider: group.slots.find((s) => s.is_leader),
          companeros: group.slots.filter(
            (s) => s !== slot && (s.player_name ?? "").trim() !== "",
          ),
        };
      }
    }
  }

  return null;
}

export function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Fecha y hora en la zona de origen, con su referencia explícita. */
export function formatearEvento(iso: string, tz: string): string {
  try {
    const texto = new Intl.DateTimeFormat("es-AR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: tz,
    }).format(new Date(iso));
    return `${texto} — hora de ${tz.split("/").pop()?.replace(/_/g, " ")}`;
  } catch {
    return new Date(iso).toLocaleString("es-AR");
  }
}
