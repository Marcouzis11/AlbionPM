import "server-only";

import type { Build, BuildFolder, Role } from "@/lib/builds-shared";
import { createClient } from "@/lib/supabase/server";

export type { Build, BuildFolder, Role } from "@/lib/builds-shared";
export { countFolderChildren } from "@/lib/builds-shared";

/**
 * Acceso a la biblioteca de builds: carpetas anidadas, builds, roles.
 *
 * Las consultas van con la sesión del usuario y RLS filtra por dueño. No se
 * repite ese filtro acá a propósito: duplicarlo daría la falsa impresión de
 * que la seguridad depende de que nadie se olvide de escribirlo.
 */

export async function listFolders(gameId: string): Promise<BuildFolder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("build_folders")
    .select("id, parent_id, name, color, position")
    .eq("game_id", gameId)
    .order("position")
    .order("name");

  if (error) throw new Error(`No se pudieron leer las carpetas: ${error.message}`);
  return data ?? [];
}

export async function listBuilds(gameId: string): Promise<Build[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("builds")
    .select("id, folder_id, name, role_id, color, tags, items, notes, position, updated_at")
    .eq("game_id", gameId)
    // Por orden manual, y el nombre solo para desempatar las que nunca se
    // movieron y comparten posición.
    .order("position")
    .order("name");

  if (error) throw new Error(`No se pudieron leer las builds: ${error.message}`);
  return (data ?? []) as Build[];
}

export async function getBuild(id: string): Promise<Build | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("builds")
    .select("id, folder_id, name, role_id, color, tags, items, notes, position, updated_at")
    .eq("id", id)
    .maybeSingle();

  return data as Build | null;
}

/** Roles del sistema y propios, en un solo listado. */
export async function listRoles(gameId: string): Promise<Role[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, name, icon, color, owner_id")
    .eq("game_id", gameId)
    .order("position");

  if (error) throw new Error(`No se pudieron leer los roles: ${error.message}`);
  return data ?? [];
}
