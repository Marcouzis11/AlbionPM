"use client";

import { ChevronRight, Folder, FolderPlus, Home, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  countBuildUsage,
  createBuild,
  createFolder,
  deleteBuild,
  deleteFolder,
} from "@/app/actions/builds";
import { BuildEditor } from "@/components/build-editor";
import type { UsedColor } from "@/components/color-picker";
import { ItemIcon } from "@/components/item-icon";
import {
  countFolderChildren,
  type Build,
  type BuildFolder,
  type Role,
} from "@/lib/builds-shared";

/**
 * Biblioteca de builds.
 *
 * La navegación de carpetas es por ruta y no por árbol lateral: estás *dentro*
 * de una carpeta y ves sus subcarpetas y sus builds. Un árbol permanente
 * ocupaba una columna fija para algo que se toca de vez en cuando, y con
 * carpetas anidadas se volvía ilegible por la sangría.
 */
export function BuildsLibrary({
  gameId,
  folders,
  builds,
  roles,
}: {
  gameId: string;
  folders: BuildFolder[];
  builds: Build[];
  roles: Role[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [carpetaActual, setCarpetaActual] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [editing, setEditing] = useState<Build | null>(null);
  const [confirm, setConfirm] = useState<Confirmacion | null>(null);

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  const usedColors: UsedColor[] = useMemo(
    () =>
      builds
        .filter((b) => b.color)
        .map((b) => ({
          color: b.color!,
          buildName: b.name,
          roleName: b.role_id ? roleById.get(b.role_id)?.name : null,
        })),
    [builds, roleById],
  );

  const allTags = useMemo(
    () => [...new Set(builds.flatMap((b) => b.tags))].sort(),
    [builds],
  );

  /** Camino desde la raíz hasta la carpeta actual, para las migas de pan. */
  const camino = useMemo(() => {
    const salida: BuildFolder[] = [];
    let actual = carpetaActual;
    while (actual) {
      const f = folderById.get(actual);
      if (!f) break;
      salida.unshift(f);
      actual = f.parent_id;
    }
    return salida;
  }, [carpetaActual, folderById]);

  const subcarpetas = folders.filter((f) => f.parent_id === carpetaActual);
  const buscando = query.trim() !== "" || roleFilter !== "" || tagFilter !== "";

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return builds.filter((build) => {
      // Buscar mira TODA la biblioteca: si hay que acordarse en qué carpeta
      // quedó algo para poder encontrarlo, el buscador no sirve.
      if (!buscando && build.folder_id !== carpetaActual) return false;
      if (roleFilter && build.role_id !== roleFilter) return false;
      if (tagFilter && !build.tags.includes(tagFilter)) return false;
      if (q && !build.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [builds, carpetaActual, roleFilter, tagFilter, query, buscando]);

  function nuevaCarpeta() {
    const name = window.prompt("Nombre de la carpeta");
    if (!name?.trim()) return;
    startTransition(async () => {
      await createFolder(gameId, name, carpetaActual);
      router.refresh();
    });
  }

  function nuevaBuild() {
    startTransition(async () => {
      await createBuild(gameId, carpetaActual);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Builds</h1>
        <p className="mt-1 text-sm text-muted">
          El color que le pongas a una build pinta la fila de esa persona en todas las
          composiciones donde la uses.
        </p>
      </div>

      {/* Migas de pan: dónde estás y cómo volver, en una sola línea. */}
      <nav aria-label="Carpeta actual" className="flex flex-wrap items-center gap-0.5 text-sm">
        <button
          type="button"
          onClick={() => setCarpetaActual(null)}
          className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 transition-colors ${
            carpetaActual === null ? "text-text" : "text-muted hover:bg-surface-2"
          }`}
        >
          <Home size={15} aria-hidden />
          Todas
        </button>
        {camino.map((f) => (
          <span key={f.id} className="flex items-center gap-0.5">
            <ChevronRight size={14} className="text-muted" aria-hidden />
            <button
              type="button"
              onClick={() => setCarpetaActual(f.id)}
              className={`h-9 max-w-40 truncate rounded-lg px-2.5 transition-colors ${
                carpetaActual === f.id ? "text-text" : "text-muted hover:bg-surface-2"
              }`}
            >
              {f.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar en todas las carpetas…"
          aria-label="Buscar build"
          className="h-10 w-full min-w-44 rounded-lg border border-border bg-surface px-3 text-sm sm:w-56"
        />
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          aria-label="Filtrar por rol"
          className="h-10 rounded-lg border border-border bg-surface px-2.5 text-sm"
        >
          <option value="">Todos los roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            aria-label="Filtrar por tag"
            className="h-10 rounded-lg border border-border bg-surface px-2.5 text-sm"
          >
            <option value="">Todos los tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={nuevaCarpeta}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
          >
            <FolderPlus size={15} aria-hidden />
            <span className="hidden sm:inline">Carpeta</span>
          </button>
          <button
            type="button"
            onClick={nuevaBuild}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg hover:bg-accent-hover"
          >
            <Plus size={15} aria-hidden />
            Nueva build
          </button>
        </div>
      </div>

      {/* Subcarpetas como fichas chatas: ocupan una fila, no una columna. */}
      {!buscando && subcarpetas.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {subcarpetas.map((f) => {
            const dentro = countFolderChildren(f.id, folders, builds);
            return (
              <li key={f.id}>
                <div className="group flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 hover:border-accent">
                  <button
                    type="button"
                    onClick={() => setCarpetaActual(f.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                  >
                    <Folder size={16} className="shrink-0 text-muted" aria-hidden />
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {dentro.builds}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirm({
                        tipo: "carpeta",
                        folder: f,
                        subcarpetas: dentro.folders,
                        buildsDentro: dentro.builds,
                      })
                    }
                    aria-label={`Borrar carpeta ${f.name}`}
                    className="flex size-7 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
          {builds.length === 0
            ? "Todavía no tenés builds. Creá la primera."
            : buscando
              ? "Ninguna build coincide con el filtro."
              : "Esta carpeta no tiene builds."}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {visibles.map((build) => (
            <li key={build.id}>
              <div
                className="flex min-h-14 flex-wrap items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
                style={
                  build.color
                    ? { background: `${build.color}1f`, borderColor: `${build.color}55` }
                    : undefined
                }
              >
                <div className="flex shrink-0 gap-1">
                  {(["mainhand", "offhand", "head", "armor", "shoes"] as const).map((slot) =>
                    build.items[slot] ? (
                      <ItemIcon key={slot} item={build.items[slot]} size={28} />
                    ) : (
                      <span
                        key={slot}
                        className="size-7 shrink-0 rounded border border-dashed border-border"
                      />
                    ),
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={build.name}>
                    {build.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {build.role_id ? roleById.get(build.role_id)?.name : "Sin rol"}
                    {buscando && build.folder_id && folderById.get(build.folder_id)
                      ? ` · ${folderById.get(build.folder_id)!.name}`
                      : ""}
                    {build.tags.length > 0 && ` · ${build.tags.join(", ")}`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditing(build)}
                  className="h-9 shrink-0 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={async () =>
                    setConfirm({
                      tipo: "build",
                      build,
                      usos: await countBuildUsage(build.id),
                    })
                  }
                  aria-label={`Borrar ${build.name}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:text-danger"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <BuildEditor
          build={editing}
          roles={roles}
          usedColors={usedColors}
          onClose={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      )}

      {confirm && (
        <DialogoBorrado
          confirmacion={confirm}
          onCancel={() => setConfirm(null)}
          onDone={() => {
            setConfirm(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

type Confirmacion =
  | { tipo: "carpeta"; folder: BuildFolder; subcarpetas: number; buildsDentro: number }
  | { tipo: "build"; build: Build; usos: number };

/**
 * Diálogo de borrado: dice exactamente qué se pierde.
 *
 * Un «¿estás seguro?» pelado no protege de nada porque se clickea en
 * automático. Cuando el daño es grande —una carpeta con contenido— pide
 * escribir el nombre, que es la única barrera que un click distraído no pasa.
 */
function DialogoBorrado({
  confirmacion,
  onCancel,
  onDone,
}: {
  confirmacion: Confirmacion;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [pending, startTransition] = useTransition();

  const conContenido =
    confirmacion.tipo === "carpeta" &&
    (confirmacion.subcarpetas > 0 || confirmacion.buildsDentro > 0);

  const nombre =
    confirmacion.tipo === "carpeta" ? confirmacion.folder.name : confirmacion.build.name;

  const puede = !conContenido || texto.trim() === nombre;

  function ejecutar(rescatar: boolean) {
    startTransition(async () => {
      if (confirmacion.tipo === "carpeta") {
        await deleteFolder(confirmacion.folder.id, rescatar);
      } else {
        await deleteBuild(confirmacion.build.id);
      }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Borrar «{nombre}»</h2>

        {confirmacion.tipo === "carpeta" ? (
          <div className="mt-3 space-y-3 text-sm">
            {conContenido ? (
              <>
                <p>
                  Contiene <strong>{confirmacion.subcarpetas}</strong> subcarpeta
                  {confirmacion.subcarpetas === 1 ? "" : "s"} y{" "}
                  <strong>{confirmacion.buildsDentro}</strong> build
                  {confirmacion.buildsDentro === 1 ? "" : "s"}.
                </p>
                <p className="text-muted">
                  Podés rescatar el contenido moviéndolo un nivel arriba, o borrar todo.
                  Esto no se puede deshacer.
                </p>
                <label className="block">
                  <span className="text-xs text-muted">
                    Para borrar todo, escribí «{nombre}»
                  </span>
                  <input
                    value={texto}
                    onChange={(event) => setTexto(event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-surface-2 px-3"
                  />
                </label>
              </>
            ) : (
              <p className="text-muted">La carpeta está vacía.</p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {confirmacion.usos > 0 ? (
              <>
                <p>
                  Se usa en <strong>{confirmacion.usos}</strong>{" "}
                  {confirmacion.usos === 1 ? "persona" : "personas"} de tus composiciones.
                </p>
                <p className="text-muted">
                  Esos lugares quedan sin equipo pero{" "}
                  <strong className="text-text">conservan el rol y el nombre</strong>. No se
                  rompe ninguna composición.
                </p>
              </>
            ) : (
              <p className="text-muted">No se usa en ninguna composición.</p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-surface-2"
          >
            Cancelar
          </button>

          {conContenido && (
            <button
              type="button"
              onClick={() => ejecutar(true)}
              disabled={pending}
              className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-surface-2"
            >
              Rescatar el contenido
            </button>
          )}

          <button
            type="button"
            onClick={() => ejecutar(false)}
            disabled={pending || !puede}
            className="h-10 rounded-lg bg-danger px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "Borrando…" : conContenido ? "Borrar todo" : "Borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
