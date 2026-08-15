import "server-only";

import type { Composition } from "@/lib/compositions-shared";
import { createClient } from "@/lib/supabase/server";

export type { CompGroup, CompSlot, Composition } from "@/lib/compositions-shared";

/** Resumen para listados e historial, sin traer los grupos. */
export type CompositionSummary = {
  id: string;
  content_id: string;
  name: string;
  description: string | null;
  event_at: string;
  event_tz: string;
  is_archived: boolean;
  share_slug: string | null;
  visibility: "private" | "unlisted" | "public";
};

const CAMPOS =
  "id, content_id, name, description, event_at, event_tz, is_archived, share_slug, visibility";

export async function listCompositions(contentId: string): Promise<CompositionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compositions")
    .select(CAMPOS)
    .eq("content_id", contentId)
    .order("event_at", { ascending: false });

  if (error) throw new Error(`No se pudieron leer las composiciones: ${error.message}`);
  return (data ?? []) as CompositionSummary[];
}

/** Historial: todas las composiciones del usuario, de la más reciente a la más vieja. */
/**
 * El historial: las composiciones que llegaron a compartirse.
 *
 * No son todas. Una composición a medio armar, o una prueba que quedó por ahí,
 * no es historia de nada: ensucia la lista y hace que encontrar la CTA del
 * sábado pasado cueste más. Compartir es el momento en que una composición pasa
 * de borrador a algo que se usó de verdad, así que ese es el corte.
 */
export async function listAllCompositions(): Promise<CompositionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compositions")
    .select(CAMPOS)
    .not("share_slug", "is", null)
    .order("event_at", { ascending: false });

  if (error) throw new Error(`No se pudo leer el historial: ${error.message}`);
  return (data ?? []) as CompositionSummary[];
}

/**
 * Una composición completa, con sus grupos y personas.
 *
 * Va en una sola consulta anidada: la vista pública se abre desde un celular
 * con mala señal y no puede permitirse tres viajes al servidor.
 */
export async function getComposition(id: string): Promise<Composition | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compositions")
    .select(
      `${CAMPOS},
       comp_groups (
         id, position, name, guild_name,
         comp_slots ( id, position, role_id, build_id, player_name, is_leader, notes )
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return normalizar(data);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizar(row: any): Composition {
  return {
    id: row.id,
    content_id: row.content_id,
    name: row.name,
    description: row.description,
    event_at: row.event_at,
    event_tz: row.event_tz,
    is_archived: row.is_archived,
    share_slug: row.share_slug,
    visibility: row.visibility,
    groups: (row.comp_groups ?? [])
      .map((group: any) => ({
        id: group.id,
        position: group.position,
        name: group.name,
        guild_name: group.guild_name,
        slots: (group.comp_slots ?? []).sort(
          (a: any, b: any) => a.position - b.position,
        ),
      }))
      .sort((a: Composition["groups"][number], b: Composition["groups"][number]) =>
        a.position - b.position,
      ),
  };
}

/**
 * Todas las composiciones de un juego, para la pantalla de Party Maker.
 *
 * Va en una sola consulta y no una por contenido: con ocho contenidos serían
 * ocho viajes al servidor para pintar una pantalla que se abre todo el tiempo.
 */
export async function listCompositionsForGame(
  gameId: string,
): Promise<CompositionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compositions")
    .select(`${CAMPOS}, contents!inner(game_id)`)
    .eq("contents.game_id", gameId)
    .order("event_at", { ascending: false });

  if (error) throw new Error(`No se pudieron leer las composiciones: ${error.message}`);
  return (data ?? []) as unknown as CompositionSummary[];
}
