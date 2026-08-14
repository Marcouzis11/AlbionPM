"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Altas, ediciones y bajas de la biblioteca de builds.
 *
 * Los borrados que afectan a otras cosas no se resuelven acá. La base rechaza
 * borrar una carpeta con contenido (`ON DELETE RESTRICT`), y la interfaz tiene
 * que preguntar antes y ofrecer rescatar lo de adentro.
 */

export type ActionState = { error?: string; id?: string };

/** Los nueve slots de equipo. Zod valida la forma antes de escribir. */
const buildItemSchema = z.object({
  id: z.string().regex(/^T\d_[A-Z0-9_]+$/, "Identificador de item inválido"),
  ench: z.number().int().min(0).max(4).optional(),
  quality: z.number().int().min(1).max(5).optional(),
});

/**
 * Los nueve slots, todos opcionales.
 *
 * Va con `partialRecord` y NO con `record`: en Zod 4, `z.record` con claves de
 * enumeración es exhaustivo, o sea que exige que estén las nueve. Con eso,
 * ninguna build a medio armar se podía guardar — y una con arma a dos manos no
 * se podía guardar NUNCA, porque el off-hand se bloquea a propósito y entonces
 * esa clave jamás iba a existir.
 */
const itemsSchema = z.partialRecord(
  z.enum([
    "mainhand",
    "offhand",
    "head",
    "armor",
    "shoes",
    "cape",
    "food",
    "potion",
    "mount",
  ]),
  buildItemSchema,
);

const HEX = /^#[0-9A-Fa-f]{6}$/;

// ─── Carpetas ────────────────────────────────────────────────────────────────

export async function createFolder(
  gameId: string,
  name: string,
  parentId: string | null,
): Promise<ActionState> {
  const clean = name.trim();
  if (!clean) return { error: "Ponele un nombre a la carpeta." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Necesitás iniciar sesión." };

  const { data, error } = await supabase
    .from("build_folders")
    .insert({
      owner_id: userData.user.id,
      game_id: gameId,
      parent_id: parentId,
      name: clean,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/app", "layout");
  return { id: data.id };
}

export async function renameFolder(id: string, name: string): Promise<ActionState> {
  const clean = name.trim();
  if (!clean) return { error: "El nombre no puede quedar vacío." };

  const supabase = await createClient();
  const { error } = await supabase.from("build_folders").update({ name: clean }).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return {};
}

/**
 * Borra una carpeta.
 *
 * `rescatar` mueve subcarpetas y builds un nivel arriba en vez de perderlas.
 * Es la opción que ofrece el diálogo cuando la carpeta no está vacía.
 */
export async function deleteFolder(id: string, rescatar: boolean): Promise<ActionState> {
  const supabase = await createClient();

  const { data: folder } = await supabase
    .from("build_folders")
    .select("parent_id")
    .eq("id", id)
    .maybeSingle();

  if (!folder) return { error: "Esa carpeta ya no existe." };

  if (rescatar) {
    // El orden importa: primero se vacía, después se borra. Al revés, la base
    // rechazaría el borrado por las referencias.
    await supabase.from("build_folders").update({ parent_id: folder.parent_id }).eq("parent_id", id);
    await supabase.from("builds").update({ folder_id: folder.parent_id }).eq("folder_id", id);
  } else {
    await supabase.from("builds").delete().eq("folder_id", id);
    await borrarSubcarpetas(id);
  }

  const { error } = await supabase.from("build_folders").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/app", "layout");
  return {};
}

/** Borrado recursivo de subcarpetas, de las hojas hacia la raíz. */
async function borrarSubcarpetas(parentId: string) {
  const supabase = await createClient();
  const { data: hijas } = await supabase
    .from("build_folders")
    .select("id")
    .eq("parent_id", parentId);

  for (const hija of hijas ?? []) {
    await supabase.from("builds").delete().eq("folder_id", hija.id);
    await borrarSubcarpetas(hija.id);
    await supabase.from("build_folders").delete().eq("id", hija.id);
  }
}

// ─── Builds ──────────────────────────────────────────────────────────────────

export async function createBuild(
  gameId: string,
  folderId: string | null,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Necesitás iniciar sesión." };

  const { data, error } = await supabase
    .from("builds")
    .insert({
      owner_id: userData.user.id,
      game_id: gameId,
      folder_id: folderId,
      name: "Build sin nombre",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/app", "layout");
  return { id: data.id };
}

export async function saveBuild(
  id: string,
  patch: {
    name?: string;
    role_id?: string | null;
    color?: string | null;
    tags?: string[];
    items?: unknown;
    notes?: string | null;
    folder_id?: string | null;
  },
): Promise<ActionState> {
  const update: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const clean = patch.name.trim();
    if (!clean) return { error: "La build necesita un nombre." };
    update.name = clean;
  }

  if (patch.color !== undefined) {
    if (patch.color !== null && !HEX.test(patch.color)) {
      return { error: "El color tiene que ser un hexadecimal tipo #RRGGBB." };
    }
    update.color = patch.color;
  }

  if (patch.items !== undefined) {
    const parsed = itemsSchema.safeParse(patch.items);
    if (!parsed.success) return { error: "El equipo de la build tiene un formato inválido." };
    update.items = parsed.data;
  }

  if (patch.tags !== undefined) {
    // Sin duplicados, sin vacíos y en minúsculas: los tags son para filtrar, y
    // "ZvZ" y "zvz" partirían el filtro en dos sin que se note.
    update.tags = [...new Set(patch.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  }

  if (patch.role_id !== undefined) update.role_id = patch.role_id;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.folder_id !== undefined) update.folder_id = patch.folder_id;

  if (Object.keys(update).length === 0) return {};

  const supabase = await createClient();
  const { error } = await supabase.from("builds").update(update).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/app", "layout");
  return {};
}

/**
 * Cuántas composiciones usan esta build.
 *
 * El diálogo de borrado necesita el número para poder avisar en vez de borrar
 * a ciegas. Los slots afectados conservan rol y nombre: la base pone
 * `build_id` en NULL, no borra la fila.
 */
export async function countBuildUsage(id: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("comp_slots")
    .select("id", { count: "exact", head: true })
    .eq("build_id", id);

  return count ?? 0;
}

export async function deleteBuild(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("builds").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/app", "layout");
  return {};
}
