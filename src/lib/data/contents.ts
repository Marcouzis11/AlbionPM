import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { getSupabaseConfig } from "@/lib/supabase/config";
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

/**
 * Los juegos, cacheados entre pedidos.
 *
 * Es la tabla más chica y más quieta de todas: hoy tiene una fila, creada una
 * vez, y aun así se consultaba en CADA navegación entre secciones. A 400 ms de
 * ida y vuelta, eso era medio segundo regalado por pantalla.
 *
 * El cliente que se usa acá NO lee cookies, y no es un detalle: `unstable_cache`
 * no admite fuentes de datos por pedido adentro. Puede hacerlo porque la
 * política de la tabla es `using (true)`: los juegos son datos públicos de
 * referencia, iguales para todos.
 */
const leerJuegos = unstable_cache(
  async (): Promise<Game[]> => {
    const config = getSupabaseConfig();
    if (!config) return [];

    const supabase = createSupabaseClient(config.url, config.key);
    const { data, error } = await supabase
      .from("games")
      .select("id, slug, name, icon")
      .order("position");

    if (error) throw new Error(`No se pudieron leer los juegos: ${error.message}`);
    return data ?? [];
  },
  ["juegos"],
  { revalidate: 3600, tags: ["juegos"] },
);

export async function listGames(): Promise<Game[]> {
  return leerJuegos();
}

/**
 * Sale de la lista cacheada y no de una consulta propia.
 *
 * Cada pantalla necesita el `id` del juego ANTES de poder pedir sus datos, así
 * que esta consulta era un viaje de red en serie, delante de todos los demás:
 * bloqueaba la pantalla entera sin aportar nada que cambie.
 */
export async function getGameBySlug(slug: string): Promise<Game | null> {
  const juegos = await leerJuegos();
  return juegos.find((juego) => juego.slug === slug) ?? null;
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
