import type { BuildItem } from "@/lib/items";

/**
 * Tipos y lógica pura de la biblioteca de builds.
 *
 * Está separado de `lib/data/builds.ts` porque aquel consulta la base y lleva
 * `server-only`. Los componentes que corren en el navegador necesitan estos
 * tipos y este cálculo, y no pueden arrastrar el cliente de Supabase del
 * servidor al bundle.
 */

export type BuildFolder = {
  id: string;
  parent_id: string | null;
  name: string;
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
