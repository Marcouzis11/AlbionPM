"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { ShareFormats } from "@/lib/shared-composition";
import { createClient } from "@/lib/supabase/server";

/** Compartir cambia la composición, el historial y la vista pública. */
function revalidarCompartido() {
  revalidatePath("/app/[game]/comp/[compId]", "page");
  revalidatePath("/app/[game]/historial", "page");
  revalidatePath("/p/[slug]", "page");
}

export type ShareState = { error?: string; slug?: string };

/**
 * Alfabeto sin caracteres que se confundan al dictarlos por voz en Discord:
 * nada de 0/O ni 1/l/I. Alguien va a leer este link en voz alta durante una
 * CTA, y "cero o o" no es una conversación que quieras tener.
 */
const ALFABETO = "23456789abcdefghijkmnpqrstuvwxyz";
const LARGO = 10;

function generarSlug(): string {
  const bytes = randomBytes(LARGO);
  let slug = "";
  for (let i = 0; i < LARGO; i++) slug += ALFABETO[bytes[i] % ALFABETO.length];
  return slug;
}

/**
 * Activa el link público de una composición.
 *
 * El slug se genera al azar y es largo: es un link "no listado", así que su
 * seguridad depende de que no se pueda adivinar. 32^10 combinaciones alcanzan
 * de sobra para eso.
 */
export async function enableSharing(
  compositionId: string,
  visibility: "unlisted" | "public",
): Promise<ShareState> {
  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("compositions")
    .select("share_slug")
    .eq("id", compositionId)
    .maybeSingle();

  // Si ya tenía slug se conserva: regenerarlo rompería los links que la gente
  // ya guardó en el celular o pegó en Discord.
  const slug = actual?.share_slug ?? generarSlug();

  const { error } = await supabase
    .from("compositions")
    .update({ share_slug: slug, visibility })
    .eq("id", compositionId);

  if (error) return { error: error.message };

  revalidarCompartido();
  return { slug };
}

export async function disableSharing(compositionId: string): Promise<ShareState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compositions")
    .update({ visibility: "private" })
    .eq("id", compositionId);

  if (error) return { error: error.message };

  revalidarCompartido();
  return {};
}

export async function updateShareFormats(
  compositionId: string,
  formats: ShareFormats,
): Promise<ShareState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compositions")
    .update({ share_formats: formats })
    .eq("id", compositionId);

  if (error) return { error: error.message };

  revalidarCompartido();
  return {};
}
