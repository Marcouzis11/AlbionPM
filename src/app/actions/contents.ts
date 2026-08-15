"use server";

import { revalidatePath } from "next/cache";

import { colorSugerido, esColorDeContenido } from "@/lib/color";
import { createClient } from "@/lib/supabase/server";

/** Los contenidos se ven en el Party Maker y se nombran en el historial. */
function revalidarContenidos() {
  revalidatePath("/app/[game]", "page");
  revalidatePath("/app/[game]/historial", "page");
}

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

  revalidarContenidos();
  return {};
}

export async function renameContent(id: string, name: string): Promise<ContentState> {
  const clean = name.trim();
  if (!clean) return { error: "El nombre no puede quedar vacío." };

  const supabase = await createClient();
  const { error } = await supabase.from("contents").update({ name: clean }).eq("id", id);

  if (error) return { error: error.message };

  revalidarContenidos();
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

/**
 * Borra un contenido con todo lo que tiene adentro.
 *
 * La base tiene `ON DELETE RESTRICT` de `compositions` sobre `contents`, así
 * que el orden no es opcional: primero las composiciones, después el
 * contenido. Los grupos y los lugares de cada composición se van solos, que
 * esos sí están en cascada.
 *
 * **Las builds no se tocan.** Viven en su propia tabla y una composición
 * apenas las referencia desde `comp_slots.build_id`, con `ON DELETE SET NULL`.
 * Borrar composiciones no puede llevarse ni una build por delante.
 *
 * El `owner_id` va en los dos borrados aunque las políticas de la base ya
 * limiten cada usuario a lo suyo: si algún día una política se afloja, el
 * borrado no se convierte en un borrado ajeno.
 *
 * No hay papelera ni copias de seguridad, así que la interfaz tiene que
 * mostrar la lista completa de lo que se pierde ANTES de llamar acá.
 */
export async function deleteContentWithCompositions(
  id: string,
): Promise<ContentState> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Necesitás iniciar sesión." };

  const { error: errorComps } = await supabase
    .from("compositions")
    .delete()
    .eq("content_id", id)
    .eq("owner_id", userData.user.id);

  if (errorComps) {
    return { error: `No se pudieron borrar las composiciones: ${errorComps.message}` };
  }

  const { error } = await supabase
    .from("contents")
    .delete()
    .eq("id", id)
    .eq("owner_id", userData.user.id);

  if (error) {
    // La base rechaza el borrado si quedaron composiciones. Llegar acá
    // significa que el borrado anterior no las alcanzó a todas, así que el
    // contenido sigue en pie: es un estado consistente, no uno a medias.
    if (error.code === "23503") {
      return {
        error:
          "Quedaron composiciones dentro y la base frenó el borrado. No se borró nada del contenido. Volvé a intentar.",
      };
    }
    return { error: `No se pudo borrar el contenido: ${error.message}` };
  }

  revalidarContenidos();
  return {};
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

  revalidarContenidos();
  return {};
}
