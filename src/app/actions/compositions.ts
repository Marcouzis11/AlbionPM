"use server";

import { revalidatePath } from "next/cache";

import { MAX_POR_GRUPO } from "@/lib/compositions-shared";
import { createClient } from "@/lib/supabase/server";

export type CompState = { error?: string; id?: string };

/** Plantillas que ofrece la página al crear una composición. */
export type Plantilla = "vacia" | "party20" | "gremio" | "multigremio";

const PLANTILLAS: Record<Plantilla, { grupos: number; conGremio: boolean; slots: number }> = {
  vacia: { grupos: 1, conGremio: false, slots: 0 },
  party20: { grupos: 1, conGremio: false, slots: MAX_POR_GRUPO },
  gremio: { grupos: 3, conGremio: false, slots: MAX_POR_GRUPO },
  multigremio: { grupos: 3, conGremio: true, slots: MAX_POR_GRUPO },
};

export async function createComposition(
  contentId: string,
  name: string,
  plantilla: Plantilla,
  eventAt: string,
  eventTz: string,
): Promise<CompState> {
  const clean = name.trim();
  if (!clean) return { error: "Ponele un nombre a la composición." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Necesitás iniciar sesión." };

  const { data: comp, error } = await supabase
    .from("compositions")
    .insert({
      owner_id: userData.user.id,
      content_id: contentId,
      name: clean,
      // La fecha y la hora las manda el cliente porque son las de SU máquina,
      // no las del servidor, que puede estar en otro continente.
      event_at: eventAt,
      event_tz: eventTz,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const receta = PLANTILLAS[plantilla];

  for (let g = 0; g < receta.grupos; g++) {
    const { data: group } = await supabase
      .from("comp_groups")
      .insert({
        composition_id: comp.id,
        position: g,
        name: `Grupo ${g + 1}`,
        guild_name: receta.conGremio ? `Gremio ${g + 1}` : null,
      })
      .select("id")
      .single();

    if (group && receta.slots > 0) {
      await supabase.from("comp_slots").insert(
        Array.from({ length: receta.slots }, (_, i) => ({
          group_id: group.id,
          position: i,
          // El primero de cada grupo arranca marcado como líder: en la
          // práctica siempre hay uno, y así no hay que acordarse de marcarlo.
          is_leader: i === 0,
        })),
      );
    }
  }

  revalidatePath("/app", "layout");
  return { id: comp.id };
}

export async function updateComposition(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    event_at?: string;
    event_tz?: string;
    is_archived?: boolean;
  },
): Promise<CompState> {
  const update: Record<string, unknown> = { ...patch };

  if (patch.name !== undefined) {
    const clean = patch.name.trim();
    if (!clean) return { error: "La composición necesita un nombre." };
    update.name = clean;
  }

  if (patch.is_archived !== undefined) {
    update.archived_at = patch.is_archived ? new Date().toISOString() : null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("compositions").update(update).eq("id", id);

  if (error) return { error: traducir(error.message) };

  revalidatePath("/app", "layout");
  return {};
}

// ─── Grupos y personas ───────────────────────────────────────────────────────

export async function addGroup(compositionId: string): Promise<CompState> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("comp_groups")
    .select("id", { count: "exact", head: true })
    .eq("composition_id", compositionId);

  const { error } = await supabase.from("comp_groups").insert({
    composition_id: compositionId,
    position: count ?? 0,
    name: `Grupo ${(count ?? 0) + 1}`,
  });

  if (error) return { error: traducir(error.message) };

  revalidatePath("/app", "layout");
  return {};
}

export async function updateGroup(
  id: string,
  patch: { name?: string | null; guild_name?: string | null },
): Promise<CompState> {
  const supabase = await createClient();
  const { error } = await supabase.from("comp_groups").update(patch).eq("id", id);

  if (error) return { error: traducir(error.message) };
  revalidatePath("/app", "layout");
  return {};
}

export async function deleteGroup(id: string): Promise<CompState> {
  const supabase = await createClient();
  const { error } = await supabase.from("comp_groups").delete().eq("id", id);

  if (error) return { error: traducir(error.message) };
  revalidatePath("/app", "layout");
  return {};
}

export async function addSlot(groupId: string): Promise<CompState> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("comp_slots")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);

  const position = count ?? 0;
  if (position >= MAX_POR_GRUPO) {
    return { error: `Un grupo no puede tener más de ${MAX_POR_GRUPO} personas.` };
  }

  const { error } = await supabase.from("comp_slots").insert({
    group_id: groupId,
    position,
    is_leader: position === 0,
  });

  if (error) return { error: traducir(error.message) };
  revalidatePath("/app", "layout");
  return {};
}

export async function updateSlot(
  id: string,
  patch: {
    role_id?: string | null;
    build_id?: string | null;
    player_name?: string | null;
    notes?: string | null;
  },
): Promise<CompState> {
  const supabase = await createClient();
  const { error } = await supabase.from("comp_slots").update(patch).eq("id", id);

  if (error) return { error: traducir(error.message) };
  revalidatePath("/app", "layout");
  return {};
}

/**
 * Marca a alguien como líder de su grupo.
 *
 * Hay que desmarcar al anterior ANTES de marcar al nuevo: la base tiene un
 * índice único de un solo líder por grupo y rechazaría el segundo.
 */
export async function setLeader(groupId: string, slotId: string): Promise<CompState> {
  const supabase = await createClient();

  await supabase
    .from("comp_slots")
    .update({ is_leader: false })
    .eq("group_id", groupId)
    .eq("is_leader", true);

  const { error } = await supabase
    .from("comp_slots")
    .update({ is_leader: true })
    .eq("id", slotId);

  if (error) return { error: traducir(error.message) };
  revalidatePath("/app", "layout");
  return {};
}

export async function deleteSlot(id: string): Promise<CompState> {
  const supabase = await createClient();
  const { error } = await supabase.from("comp_slots").delete().eq("id", id);

  if (error) return { error: traducir(error.message) };
  revalidatePath("/app", "layout");
  return {};
}

// ─── Acciones sobre la composición entera ────────────────────────────────────

/**
 * Duplica una composición.
 *
 * `conBuilds` en false conserva estructura, grupos, roles y nombres, y deja el
 * equipo vacío: sirve para reusar una plantilla de gente con builds distintas.
 * `contentId` permite copiarla a otro contenido, por ejemplo de Estática a CTA.
 */
export async function duplicateComposition(
  id: string,
  options: { conBuilds: boolean; contentId?: string; nombre?: string },
): Promise<CompState> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Necesitás iniciar sesión." };

  const { data: original } = await supabase
    .from("compositions")
    .select(
      `id, content_id, name, description, event_tz,
       comp_groups ( id, position, name, guild_name,
         comp_slots ( position, role_id, build_id, player_name, is_leader, notes ) )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!original) return { error: "Esa composición ya no existe." };

  const { data: copia, error } = await supabase
    .from("compositions")
    .insert({
      owner_id: userData.user.id,
      content_id: options.contentId ?? original.content_id,
      name: options.nombre ?? `${original.name} (copia)`,
      description: original.description,
      event_tz: original.event_tz,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  for (const group of (original as any).comp_groups ?? []) {
    const { data: nuevoGrupo } = await supabase
      .from("comp_groups")
      .insert({
        composition_id: copia.id,
        position: group.position,
        name: group.name,
        guild_name: group.guild_name,
      })
      .select("id")
      .single();

    if (!nuevoGrupo) continue;

    const slots = (group.comp_slots ?? []).map((slot: any) => ({
      group_id: nuevoGrupo.id,
      position: slot.position,
      role_id: slot.role_id,
      build_id: options.conBuilds ? slot.build_id : null,
      player_name: slot.player_name,
      is_leader: slot.is_leader,
      notes: slot.notes,
    }));

    if (slots.length > 0) await supabase.from("comp_slots").insert(slots);
  }

  revalidatePath("/app", "layout");
  return { id: copia.id };
}

/**
 * Vacía una composición dejando la plantilla base.
 *
 * Conserva los grupos y los roles de cada lugar; borra las builds y los
 * nombres. Es lo que se usa para reutilizar la estructura de una CTA en la
 * siguiente.
 */
export async function emptyComposition(id: string): Promise<CompState> {
  const supabase = await createClient();

  const { data: groups } = await supabase
    .from("comp_groups")
    .select("id")
    .eq("composition_id", id);

  for (const group of groups ?? []) {
    await supabase
      .from("comp_slots")
      .update({ build_id: null, player_name: null, notes: null })
      .eq("group_id", group.id);
  }

  revalidatePath("/app", "layout");
  return {};
}

export async function deleteComposition(id: string): Promise<CompState> {
  const supabase = await createClient();
  const { error } = await supabase.from("compositions").delete().eq("id", id);

  if (error) return { error: traducir(error.message) };
  revalidatePath("/app", "layout");
  return {};
}

/**
 * Los errores de la base llegan en inglés y con jerga de Postgres. Los dos que
 * puede provocar el usuario se traducen; el resto pasa tal cual, porque un
 * mensaje raro es más útil que uno genérico que no dice nada.
 */
function traducir(message: string): string {
  if (message.includes("archivada")) return message;
  if (message.includes("comp_slots_one_leader_per_group")) {
    return "Ese grupo ya tiene un líder marcado.";
  }
  return message;
}
