"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  countBuildUsage,
  createBuild,
  createFolder,
  deleteBuild,
  deleteFolder,
} from "@/app/actions/builds";
import { BuildEditor } from "@/components/build-editor";
import { ItemIcon } from "@/components/item-icon";
import type { UsedColor } from "@/components/color-picker";
import { countFolderChildren, type Build, type BuildFolder, type Role } from "@/lib/builds-shared";
import { EQUIPMENT_SLOTS } from "@/lib/items";

type Props = {
  gameId: string;
  folders: BuildFolder[];
  builds: Build[];
  roles: Role[];
};

export function BuildsLibrary({ gameId, folders, builds, roles }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [editing, setEditing] = useState<Build | null>(null);
  const [confirm, setConfirm] = useState<Confirmacion | null>(null);

  const roleById = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles],
  );

  /** Todos los colores en uso, para el selector de color. */
  const usedColors: UsedColor[] = useMemo(
    () =>
      builds
        .filter((build) => build.color)
        .map((build) => ({
          color: build.color!,
          buildName: build.name,
          roleName: build.role_id ? roleById.get(build.role_id)?.name : null,
        })),
    [builds, roleById],
  );

  const allTags = useMemo(
    () => [...new Set(builds.flatMap((build) => build.tags))].sort(),
    [builds],
  );

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return builds.filter((build) => {
      if (selectedFolder !== null && build.folder_id !== selectedFolder) return false;
      if (roleFilter && build.role_id !== roleFilter) return false;
      if (tagFilter && !build.tags.includes(tagFilter)) return false;
      if (q && !build.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [builds, selectedFolder, roleFilter, tagFilter, query]);

  const raices = folders.filter((folder) => folder.parent_id === null);

  function nuevaCarpeta(parentId: string | null) {
    const name = window.prompt("Nombre de la carpeta");
    if (!name) return;
    startTransition(async () => {
      await createFolder(gameId, name, parentId);
      router.refresh();
    });
  }

  function nuevaBuild() {
    startTransition(async () => {
      const result = await createBuild(gameId, selectedFolder);
      if (result.id) router.refresh();
    });
  }

  async function pedirBorrarCarpeta(folder: BuildFolder) {
    const { folders: subs, builds: dentro } = countFolderChildren(folder.id, folders, builds);
    setConfirm({
      tipo: "carpeta",
      folder,
      subcarpetas: subs,
      buildsDentro: dentro,
    });
  }

  async function pedirBorrarBuild(build: Build) {
    const usos = await countBuildUsage(build.id);
    setConfirm({ tipo: "build", build, usos });
  }

  return (
    <div className="flex h-full gap-6">
      {/* Árbol de carpetas */}
      <aside className="w-56 shrink-0 space-y-1">
        <div className="flex items-center justify-between px-1 pb-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Carpetas
          </h2>
          <button
            type="button"
            onClick={() => nuevaCarpeta(null)}
            title="Nueva carpeta"
            className="rounded px-1 text-muted hover:text-text"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={() => setSelectedFolder(null)}
          className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${
            selectedFolder === null ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2"
          }`}
        >
          Todas ({builds.length})
        </button>

        {raices.map((folder) => (
          <FolderNode
            key={folder.id}
            folder={folder}
            folders={folders}
            builds={builds}
            depth={0}
            selected={selectedFolder}
            onSelect={setSelectedFolder}
            onCreateChild={nuevaCarpeta}
            onDelete={pedirBorrarCarpeta}
          />
        ))}
      </aside>

      {/* Listado */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar build…"
            className="w-48 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
          />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm"
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
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm"
            >
              <option value="">Todos los tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={nuevaBuild}
            className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover"
          >
            + Nueva build
          </button>
        </div>

        {visibles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
            {builds.length === 0
              ? "Todavía no tenés builds. Creá la primera."
              : "Ninguna build coincide con el filtro."}
          </div>
        ) : (
          <ul className="space-y-2">
            {visibles.map((build) => (
              <li key={build.id}>
                <div
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                  style={
                    build.color
                      ? { background: `${build.color}22`, borderColor: `${build.color}66` }
                      : undefined
                  }
                >
                  <div className="flex gap-1">
                    {EQUIPMENT_SLOTS.slice(0, 6).map((slot) =>
                      build.items[slot] ? (
                        <ItemIcon key={slot} item={build.items[slot]} size={32} />
                      ) : (
                        <span
                          key={slot}
                          className="size-8 rounded border border-dashed border-border"
                        />
                      ),
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{build.name}</p>
                    <p className="truncate text-xs text-muted">
                      {build.role_id ? roleById.get(build.role_id)?.name : "Sin rol"}
                      {build.tags.length > 0 && ` · ${build.tags.join(", ")}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditing(build)}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => pedirBorrarBuild(build)}
                    aria-label={`Borrar ${build.name}`}
                    className="rounded-lg px-2 py-1.5 text-muted hover:text-danger"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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

// ─── Árbol ───────────────────────────────────────────────────────────────────

function FolderNode({
  folder,
  folders,
  builds,
  depth,
  selected,
  onSelect,
  onCreateChild,
  onDelete,
}: {
  folder: BuildFolder;
  folders: BuildFolder[];
  builds: Build[];
  depth: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onDelete: (folder: BuildFolder) => void;
}) {
  const hijas = folders.filter((f) => f.parent_id === folder.id);
  const propias = builds.filter((b) => b.folder_id === folder.id).length;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md pr-1 ${
          selected === folder.id ? "bg-surface-2" : "hover:bg-surface-2"
        }`}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className={`min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm ${
            selected === folder.id ? "text-text" : "text-muted"
          }`}
        >
          {folder.name} <span className="text-[11px]">({propias})</span>
        </button>
        <button
          type="button"
          onClick={() => onCreateChild(folder.id)}
          title="Subcarpeta"
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onDelete(folder)}
          title="Borrar carpeta"
          className="px-1 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
        >
          ×
        </button>
      </div>

      {hijas.map((hija) => (
        <FolderNode
          key={hija.id}
          folder={hija}
          folders={folders}
          builds={builds}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// ─── Diálogos de borrado ─────────────────────────────────────────────────────

type Confirmacion =
  | { tipo: "carpeta"; folder: BuildFolder; subcarpetas: number; buildsDentro: number }
  | { tipo: "build"; build: Build; usos: number };

/**
 * Diálogo de borrado.
 *
 * Dice exactamente qué se pierde. Un "¿estás seguro?" pelado no protege de
 * nada, porque se clickea en automático.
 *
 * Cuando el daño es grande —una carpeta con contenido— exige escribir el
 * nombre: es la única barrera que un click distraído no atraviesa.
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

  const esCarpetaConContenido =
    confirmacion.tipo === "carpeta" &&
    (confirmacion.subcarpetas > 0 || confirmacion.buildsDentro > 0);

  const nombre =
    confirmacion.tipo === "carpeta" ? confirmacion.folder.name : confirmacion.build.name;

  const puedeBorrar = !esCarpetaConContenido || texto.trim() === nombre;

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Borrar «{nombre}»</h2>

        {confirmacion.tipo === "carpeta" ? (
          <div className="mt-3 space-y-3 text-sm">
            {esCarpetaConContenido ? (
              <>
                <p>
                  Esta carpeta contiene{" "}
                  <strong>
                    {confirmacion.subcarpetas} subcarpeta
                    {confirmacion.subcarpetas === 1 ? "" : "s"}
                  </strong>{" "}
                  y{" "}
                  <strong>
                    {confirmacion.buildsDentro} build
                    {confirmacion.buildsDentro === 1 ? "" : "s"}
                  </strong>
                  .
                </p>
                <p className="text-muted">
                  Podés rescatar el contenido moviéndolo un nivel arriba, o borrar
                  todo. Esto no se puede deshacer.
                </p>
                <label className="block">
                  <span className="text-xs text-muted">
                    Para borrar todo, escribí «{nombre}»
                  </span>
                  <input
                    value={texto}
                    onChange={(event) => setTexto(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5"
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
                  Esta build se usa en <strong>{confirmacion.usos}</strong>{" "}
                  {confirmacion.usos === 1 ? "persona" : "personas"} de tus
                  composiciones.
                </p>
                <p className="text-muted">
                  Si la borrás, esos lugares quedan sin equipo pero{" "}
                  <strong className="text-text">
                    conservan el rol y el nombre de la persona
                  </strong>
                  . No se rompe ninguna composición.
                </p>
              </>
            ) : (
              <p className="text-muted">No se está usando en ninguna composición.</p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Cancelar
          </button>

          {esCarpetaConContenido && (
            <button
              type="button"
              onClick={() => ejecutar(true)}
              disabled={pending}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2"
            >
              Rescatar el contenido
            </button>
          )}

          <button
            type="button"
            onClick={() => ejecutar(false)}
            disabled={pending || !puedeBorrar}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "Borrando…" : esCarpetaConContenido ? "Borrar todo" : "Borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
