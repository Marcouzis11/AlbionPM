/**
 * Tipos y lógica pura de las composiciones.
 *
 * Separado del módulo de datos porque el editor corre en el navegador y no
 * puede arrastrar el cliente de Supabase del servidor al bundle.
 */

export type CompSlot = {
  id: string;
  position: number;
  role_id: string | null;
  build_id: string | null;
  player_name: string | null;
  is_leader: boolean;
  notes: string | null;
};

export type CompGroup = {
  id: string;
  position: number;
  name: string | null;
  guild_name: string | null;
  slots: CompSlot[];
};

export type Composition = {
  id: string;
  content_id: string;
  name: string;
  description: string | null;
  event_at: string;
  event_tz: string;
  is_archived: boolean;
  share_slug: string | null;
  visibility: "private" | "unlisted" | "public";
  groups: CompGroup[];
};

/** Tope de personas por grupo en Albion Online. */
export const MAX_POR_GRUPO = 20;

/**
 * Jugadores confirmados: solo los slots con un nombre escrito.
 *
 * Un slot vacío es un lugar previsto, no una persona. Esta es la cuenta que
 * alimenta el Disarray, y de paso funciona como indicador en vivo de cuánta
 * gente hay realmente confirmada.
 *
 * Ojo con los nombres que son solo espacios: `trim()` no es un detalle
 * estético, es lo que evita contar a alguien que no existe.
 */
export function contarConfirmados(composition: Composition): number {
  return composition.groups.reduce(
    (total, group) =>
      total + group.slots.filter((slot) => (slot.player_name ?? "").trim() !== "").length,
    0,
  );
}

/** Lugares previstos, con o sin nombre. */
export function contarLugares(composition: Composition): number {
  return composition.groups.reduce((total, group) => total + group.slots.length, 0);
}

/** El líder de un grupo, si hay alguno marcado. */
export function liderDe(group: CompGroup): CompSlot | undefined {
  return group.slots.find((slot) => slot.is_leader);
}

/**
 * Búsqueda tolerante para la vista pública.
 *
 * Sin acentos, sin distinguir mayúsculas y por coincidencia parcial: los
 * nombres de Albion se escriben mal siempre, y quien busca está apurado.
 */
export function normalizarNombre(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
