"use server";

import { revalidatePath } from "next/cache";

import { colorSugerido, esColorDeContenido } from "@/lib/color";
import { createClient } from "@/lib/supabase/server";

/**
 * Alta, edición, reordenamiento y baja de contenidos.
 *
 * El borrado en cascada NO se resuelve acá: la base tiene `ON DELETE RESTRICT`
 * sobre las composiciones, así que borrar un contenido con composiciones falla
 * a propósito. La interfaz tiene que preguntar primero y ofrecer moverlas.
 */

export type ContentState = { error?: string };

export async function createContent(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const name = String(formData.get("name") ?? "").trim();
  const gameId = String(formData.get("gameId") ?? "");
  const elegido = String(formData.get("color") ?? "");

  if (!name) return { error: "Ponele un nombre al contenido." };
  if (name.length > 60) return { error: "El nombre es demasiado largo." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Necesitás iniciar sesión." };

  // El siguiente lugar en la lista, para que el nuevo aparezca al final y no
  // se mezcle con los que el usuario ya ordenó.
  const { data: last } = await supabase
    .from("contents")
    .select("position")
    .eq("game_id", gameId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? -1) + 1;

  // Lo que llega del formulario se valida contra la paleta. Si no es uno de
  // los nuestros —formulario viejo en una pestaña abierta, o alguien mandando
  // el pedido a mano— se cae en el que le tocaba por rotación.
  const color = esColorDeContenido(elegido) ? elegido : colorSugerido(position);

  const { error } = await supabase.from("contents").insert({
    owner_id: userData.user.id,
    game_id: gameId,
    name,
    color,
    position,
  });

  if (error) return { error: `No se pudo crear: ${error.message}` };

  revalidatePath("/app", "layout");
  return {};
}

export async function renameContent(id: string, name: string): Promise<ContentState> {
  const clean = name.trim();
  if (!clean) return { error: "El nombre no puede quedar vacío." };

  const supabase = await createClient();
  const { error } = await supabase.from("contents").update({ name: clean }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/app", "layout");
  return {};
}

/**
 * Cuenta qué hay dentro de un contenido, para que el diálogo de borrado pueda
 * decir exactamente qué se pierde en vez de un "¿estás seguro?" vacío.
 */
export async function countContentChildren(id: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("compositions")
    .select("id", { count: "exact", head: true })
    .eq("content_id", id);

  return count ?? 0;
}

export async function deleteContent(id: string): Promise<ContentState> {
  const supabase = await createClient();
  const { error } = await supabase.from("contents").delete().eq("id", id);

  if (error) {
    // La base rechaza el borrado si quedan composiciones. Es la red de
    // seguridad por si el diálogo de la interfaz fallara.
    if (error.code === "23503") {
      return {
        error:
          "Ese contenido todavía tiene composiciones. Movelas o borralas primero.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/app", "layout");
  return {};
}
