import type { BuildItem, EquipmentSlot } from "@/lib/items";

/**
 * Tipos y lógica pura de la biblioteca de builds.
 *
 * Está separado de `lib/data/builds.ts` porque aquel consulta la base y lleva
 * `server-only`. Los componentes que corren en el navegador necesitan estos
 * tipos y este cálculo, y no pueden arrastrar el cliente de Supabase del
 * servidor al bundle.
 */

/**
 * El equipo, acomodado como en el panel de personaje del juego.
 *
 * Los huecos `null` no son relleno: son las celdas vacías que tiene el panel
 * original. Respetarlas es lo que hace que alguien que juega reconozca de un
 * vistazo qué pieza es cuál, sin leer una etiqueta.
 */
export const DISPOSICION_EQUIPO: (EquipmentSlot | null)[][] = [
  [null, "head", "cape"],
  ["mainhand", "armor", "offhand"],
  ["potion", "shoes", "food"],
  [null, "mount", null],
];

export type BuildFolder = {
  id: string;
  parent_id: string | null;
  name: string;
  /** Color de la carpeta. Lo heredan sus builds y sus subcarpetas. */
  color: string | null;
  position: number;
};

export type Role = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  owner_id: string | null;
};

export type Build = {
  id: string;
  folder_id: string | null;
  name: string;
  role_id: string | null;
  color: string | null;
  tags: string[];
  items: Record<string, BuildItem>;
  notes: string | null;
  /** Orden manual dentro de su carpeta. Ver migración 0003. */
  position: number;
  updated_at: string;
};

/**
 * Cuenta recursiva de lo que hay dentro de una carpeta.
 *
 * El diálogo de borrado tiene que poder decir "esta carpeta contiene 3
 * subcarpetas y 12 builds" con el total real, no solo el primer nivel: si
 * contara únicamente los hijos directos, alguien borraría media biblioteca
 * creyendo que borra una carpeta con dos cosas.
 */
export function countFolderChildren(
  folderId: string,
  folders: BuildFolder[],
  builds: Build[],
): { folders: number; builds: number } {
  const descendants = new Set<string>();
  const pending = [folderId];

  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const folder of folders) {
      if (folder.parent_id === current && !descendants.has(folder.id)) {
        descendants.add(folder.id);
        pending.push(folder.id);
      }
    }
  }

  const inside = new Set([folderId, ...descendants]);

  return {
    folders: descendants.size,
    builds: builds.filter((build) => build.folder_id && inside.has(build.folder_id)).length,
  };
}

/**
 * De qué color se pinta una build.
 *
 * La prioridad va de lo más específico a lo más general: el color propio de la
 * build, si no el de la carpeta donde está, si no el de la carpeta de arriba, y
 * así hasta la raíz.
 *
 * Esto es lo que permite pintar veinte builds de una sola vez poniéndole color
 * a «Tanques», y que una build puntual se salga del molde sin desarmar nada.
 * Una build sin color propio dentro de una carpeta sin color no se pinta: el
 * gris es una respuesta válida, no un error.
 */
export function colorEfectivo(
  build: Pick<Build, "color" | "folder_id">,
  folders: BuildFolder[],
): string | null {
  if (build.color) return build.color;

  const porId = new Map(folders.map((f) => [f.id, f]));
  let actual = build.folder_id;
  // Tope por si un dato inconsistente dejara un ciclo de carpetas.
  let vueltas = 0;
  while (actual && vueltas < 50) {
    const carpeta = porId.get(actual);
    if (!carpeta) break;
    if (carpeta.color) return carpeta.color;
    actual = carpeta.parent_id;
    vueltas += 1;
  }
  return null;
}
