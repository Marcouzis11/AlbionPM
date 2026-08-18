"use server";

import { revalidatePath } from "next/cache";

import { colorEfectivo, type BuildFolder } from "@/lib/builds-shared";
import { createClient } from "@/lib/supabase/server";
import {
  archivoSchema,
  CARPETA_IMPORTADOS,
  GRIS_IMPORTADOS,
  VERSION,
  type ArchivoBuilds,
  type ArchivoComposicion,
  type BuildExportada,
} from "@/lib/transferencia";

/**
 * Exportar e importar composiciones y builds.
 *
 * Una composición no se entiende sola: sin las builds que usa, lo que llega del
 * otro lado son veinte nombres y ningún equipo. Por eso el archivo de una
 * composición se lleva TAMBIÉN las builds que aparecen en ella, y al importar
 * se recrean las dos cosas y se vuelven a enganchar entre sí.
 *
 * Todo lo importado cae en «Importados» y nunca se mezcla con lo que ya tenías.
 * Es deliberado: quien importa un archivo ajeno no quiere que veinte builds
 * desconocidas aparezcan sueltas entre las suyas.
 */

export type TransferState = { error?: string; mensaje?: string };

/**
 * Las carpetas del juego, para resolver de qué color se ve cada build.
 *
 * El color heredado no puede viajar como herencia: del otro lado las carpetas
 * son otras, y todo lo importado cae en «Importados». Si se exportara el color
 * propio a secas, una build que se ve azul porque su carpeta es azul llegaría
 * gris, y quien la recibe vería algo distinto de lo que le mostraron.
 *
 * Así que la herencia se resuelve ACÁ, al exportar: lo que viaja es el color
 * que se ve, ya convertido en color propio de la build.
 */
async function carpetasDelJuego(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gameId: string,
): Promise<BuildFolder[]> {
  const { data } = await supabase
    .from("build_folders")
    .select("id, parent_id, name, color, position")
    .eq("game_id", gameId);

  return (data ?? []) as BuildFolder[];
}

function revalidarTodo() {
  revalidatePath("/app/[game]", "page");
  revalidatePath("/app/[game]/builds", "page");
  revalidatePath("/app/[game]/comp/[compId]", "page");
  revalidatePath("/app/[game]/historial", "page");
}

/* ────────────────────────────── Exportar ────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function exportarComposicion(
  gameId: string,
  id: string,
): Promise<{ archivo?: ArchivoComposicion; error?: string }> {
  const supabase = await createClient();

  const [{ data }, carpetas] = await Promise.all([
    supabase
      .from("compositions")
      .select(
        `name, description, event_tz,
         comp_groups ( position, name, guild_name,
           comp_slots ( position, player_name, is_leader, notes,
             roles ( name ),
             builds ( id, name, color, folder_id, tags, items, notes,
                      roles ( name ), build_folders ( name ) ) ) )`,
      )
      .eq("id", id)
      .maybeSingle(),
    carpetasDelJuego(supabase, gameId),
  ]);

  if (!data) return { error: "Esa composición ya no existe." };

  // Cada build aparece una sola vez en el archivo aunque la usen diez personas.
  const builds = new Map<string, BuildExportada>();

  const grupos = ((data as any).comp_groups ?? []).map((grupo: any) => ({
    position: grupo.position,
    name: grupo.name,
    guild_name: grupo.guild_name,
    lugares: (grupo.comp_slots ?? []).map((lugar: any) => {
      const build = lugar.builds;
      if (build && !builds.has(build.id)) {
        builds.set(build.id, {
          ref: build.id,
          name: build.name,
          // El que se VE: propio, o el que hereda de su carpeta.
          color: colorEfectivo(
            { color: build.color ?? null, folder_id: build.folder_id ?? null },
            carpetas,
          ),
          tags: build.tags ?? [],
          items: build.items ?? {},
          notes: build.notes ?? null,
          rol: build.roles?.name ?? null,
          carpeta: build.build_folders?.name ?? null,
        });
      }
      return {
        position: lugar.position,
        player_name: lugar.player_name,
        is_leader: lugar.is_leader,
        notes: lugar.notes,
        rol: lugar.roles?.name ?? null,
        build: build?.id ?? null,
      };
    }),
  }));

  return {
    archivo: {
      albionpm: VERSION,
      tipo: "composicion",
      exportado: new Date().toISOString(),
      composicion: {
        name: (data as any).name,
        description: (data as any).description,
        event_tz: (data as any).event_tz,
        grupos,
      },
      builds: [...builds.values()],
    },
  };
}

/** Exporta una carpeta de builds, o todas las del juego si no se pasa carpeta. */
export async function exportarBuilds(
  gameId: string,
  folderId: string | null,
  nombreCarpeta: string | null,
): Promise<{ archivo?: ArchivoBuilds; error?: string }> {
  const supabase = await createClient();

  let consulta = supabase
    .from("builds")
    .select(
      "id, name, color, folder_id, tags, items, notes, roles ( name ), build_folders ( name )",
    )
    .eq("game_id", gameId)
    .order("position");

  if (folderId) consulta = consulta.eq("folder_id", folderId);

  const [{ data, error }, carpetas] = await Promise.all([
    consulta,
    carpetasDelJuego(supabase, gameId),
  ]);
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No hay builds para exportar." };

  return {
    archivo: {
      albionpm: VERSION,
      tipo: "builds",
      exportado: new Date().toISOString(),
      origen: nombreCarpeta,
      builds: (data as any[]).map((build) => ({
        ref: build.id,
        name: build.name,
        color: colorEfectivo(
          { color: build.color ?? null, folder_id: build.folder_id ?? null },
          carpetas,
        ),
        tags: build.tags ?? [],
        items: build.items ?? {},
        notes: build.notes ?? null,
        rol: build.roles?.name ?? null,
        carpeta: build.build_folders?.name ?? null,
      })),
    },
  };
}

/* ────────────────────────────── Importar ────────────────────────────────── */

/** Busca o crea una carpeta por nombre. Importar dos veces no duplica nada. */
async function carpetaPorNombre(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  gameId: string,
  name: string,
  parentId: string | null,
): Promise<string | null> {
  // `parent_id` nulo se busca con `is` y no con `eq`: en SQL, `= null` no es
  // falso, es desconocido, y no encontraría jamás la carpeta de primer nivel.
  const base = supabase
    .from("build_folders")
    .select("id")
    .eq("game_id", gameId)
    .eq("name", name);

  const consulta = parentId === null ? base.is("parent_id", null) : base.eq("parent_id", parentId);

  const { data: existente } = await consulta.limit(1).maybeSingle();
  if (existente?.id) return existente.id;

  // Sin color a propósito, y no es un olvido: una carpeta de builds pinta lo
  // que tiene adentro. Un gris explícito acá le robaría el color a cualquier
  // build importada que no traiga el suyo, y sin color se ve gris igual.
  const { data } = await supabase
    .from("build_folders")
    .insert({ owner_id: ownerId, game_id: gameId, name, parent_id: parentId })
    .select("id")
    .single();

  return data?.id ?? null;
}

/**
 * Crea las builds del archivo dentro de una carpeta.
 *
 * Devuelve un mapa de `ref` del archivo al `id` nuevo, que es lo que después
 * permite volver a enganchar cada lugar con su build.
 */
async function crearBuilds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  gameId: string,
  folderId: string | null,
  builds: BuildExportada[],
): Promise<Map<string, string>> {
  const porRef = new Map<string, string>();
  if (builds.length === 0) return porRef;

  const { data: roles } = await supabase.from("roles").select("id, name").eq("game_id", gameId);
  const rolPorNombre = new Map(
    (roles ?? []).map((rol) => [rol.name.toLowerCase(), rol.id as string]),
  );

  const filas = builds.map((build, indice) => ({
    owner_id: ownerId,
    game_id: gameId,
    folder_id: folderId,
    name: build.name,
    color: build.color,
    tags: build.tags,
    items: build.items,
    notes: build.notes,
    position: indice,
    role_id: build.rol ? (rolPorNombre.get(build.rol.toLowerCase()) ?? null) : null,
  }));

  const { data } = await supabase.from("builds").insert(filas).select("id");

  // El orden que devuelve el insert es el mismo que se mandó.
  (data ?? []).forEach((fila, indice) => {
    const ref = builds[indice]?.ref;
    if (ref) porRef.set(ref, fila.id as string);
  });

  return porRef;
}

export async function importar(
  gameId: string,
  contenido: string,
): Promise<TransferState> {
  let crudo: unknown;
  try {
    crudo = JSON.parse(contenido);
  } catch {
    return { error: "Ese archivo no es un JSON válido." };
  }

  const leido = archivoSchema.safeParse(crudo);
  if (!leido.success) {
    return {
      error:
        "El archivo no tiene el formato de AlbionPM, o es de una versión que esta no entiende.",
    };
  }
  const archivo = leido.data;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Necesitás iniciar sesión." };
  const ownerId = userData.user.id;

  const raiz = await carpetaPorNombre(
    supabase,
    ownerId,
    gameId,
    CARPETA_IMPORTADOS,
    null,
  );
  if (!raiz) return { error: "No se pudo crear la carpeta Importados." };

  /* ─── Solo builds ─── */
  if (archivo.tipo === "builds") {
    const nombre = archivo.origen?.trim() || `Builds ${archivo.exportado.slice(0, 10)}`;
    const destino = await carpetaPorNombre(supabase, ownerId, gameId, nombre, raiz);
    const creadas = await crearBuilds(supabase, ownerId, gameId, destino, archivo.builds);

    revalidarTodo();
    return {
      mensaje: `Se importaron ${creadas.size} build${creadas.size === 1 ? "" : "s"} en «${CARPETA_IMPORTADOS} / ${nombre}».`,
    };
  }

  /* ─── Composición con sus builds ─── */
  const subcarpeta = await carpetaPorNombre(
    supabase,
    ownerId,
    gameId,
    archivo.composicion.name.slice(0, 120),
    raiz,
  );
  const porRef = await crearBuilds(
    supabase,
    ownerId,
    gameId,
    subcarpeta,
    archivo.builds,
  );

  // El contenido donde cae la composición, con el mismo nombre.
  const { data: contenidoExistente } = await supabase
    .from("contents")
    .select("id")
    .eq("game_id", gameId)
    .eq("name", CARPETA_IMPORTADOS)
    .limit(1)
    .maybeSingle();

  let contenidoId = contenidoExistente?.id as string | undefined;
  if (!contenidoId) {
    const { data: creado, error } = await supabase
      .from("contents")
      .insert({
        owner_id: ownerId,
        game_id: gameId,
        name: CARPETA_IMPORTADOS,
        color: GRIS_IMPORTADOS,
        // Igual se ordena en la pantalla, pero si algún día se ordenara por
        // posición, esta la deja donde corresponde.
        position: 9999,
      })
      .select("id")
      .single();
    if (error || !creado) return { error: "No se pudo crear el contenido Importados." };
    contenidoId = creado.id as string;
  }

  const { data: comp, error: errorComp } = await supabase
    .from("compositions")
    .insert({
      owner_id: ownerId,
      content_id: contenidoId,
      name: archivo.composicion.name,
      description: archivo.composicion.description,
      event_tz: archivo.composicion.event_tz,
    })
    .select("id")
    .single();

  if (errorComp || !comp) return { error: "No se pudo crear la composición." };

  const { data: roles } = await supabase.from("roles").select("id, name").eq("game_id", gameId);
  const rolPorNombre = new Map(
    (roles ?? []).map((rol) => [rol.name.toLowerCase(), rol.id as string]),
  );

  for (const grupo of archivo.composicion.grupos) {
    const { data: nuevoGrupo } = await supabase
      .from("comp_groups")
      .insert({
        composition_id: comp.id,
        position: grupo.position,
        name: grupo.name,
        guild_name: grupo.guild_name,
      })
      .select("id")
      .single();

    if (!nuevoGrupo || grupo.lugares.length === 0) continue;

    await supabase.from("comp_slots").insert(
      grupo.lugares.map((lugar) => ({
        group_id: nuevoGrupo.id,
        position: lugar.position,
        player_name: lugar.player_name,
        is_leader: lugar.is_leader,
        notes: lugar.notes,
        role_id: lugar.rol ? (rolPorNombre.get(lugar.rol.toLowerCase()) ?? null) : null,
        build_id: lugar.build ? (porRef.get(lugar.build) ?? null) : null,
      })),
    );
  }

  revalidarTodo();
  return {
    mensaje: `Se importó «${archivo.composicion.name}» en el contenido «${CARPETA_IMPORTADOS}», con ${porRef.size} build${porRef.size === 1 ? "" : "s"} en «${CARPETA_IMPORTADOS} / ${archivo.composicion.name}».`,
  };
}
