import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Acceso a los contenidos: Gankeo, Castillo, Avaloniana, CTA… las categorías
 * que crea cada usuario para mantener su propio orden.
 *
 * Todas las consultas van con la sesión del usuario, así que las políticas RLS
 * ya filtran por dueño. No hace falta —ni conviene— repetir ese filtro acá:
 * duplicarlo daría la falsa impresión de que la seguridad vive en el código.
 */

export type Content = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
};

export type Game = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
};

export async function listGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, slug, name, icon")
    .order("position");

  if (error) throw new Error(`No se pudieron leer los juegos: ${error.message}`);
  return data ?? [];
}

export async function getGameBySlug(slug: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("id, slug, name, icon")
    .eq("slug", slug)
    .maybeSingle();

  return data;
}

export async function listContents(gameId: string): Promise<Content[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contents")
    .select("id, name, icon, color, position")
    .eq("game_id", gameId)
    .order("position")
    .order("created_at");

  if (error) throw new Error(`No se pudieron leer los contenidos: ${error.message}`);
  return data ?? [];
}
