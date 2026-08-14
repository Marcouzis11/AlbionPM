"use client";

import { FolderPlus, Plus, Trash2 } from "lucide-react";
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
import { GrillaCarpetas, type FichaDeCarpeta } from "@/components/carpetas";
import type { UsedColor } from "@/components/color-picker";
import { ItemIcon } from "@/components/item-icon";
import {
  countFolderChildren,
  type Build,
  type BuildFolder,
  type Role,
} from "@/lib/builds-shared";
import { bordeDeFila, tinteDeFila } from "@/lib/color";

/**
 * Biblioteca de builds.
 *
 * Las carpetas son las mismas fichas que los contenidos del Party Maker y se
 * comportan igual: se abren en el lugar y muestran lo que tienen adentro sin
 * sacarte de la pantalla. Una subcarpeta abierta despliega a su vez su propia
 * grilla, así que la anidación se ve como lo que es —una carpeta dentro de
 * otra— en vez de tener que reconstruirla mentalmente desde una sangría.
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

  const buscando = query.trim() !== "" || roleFilter !== "" || tagFilter !== "";

  /** Buscar mira TODA la biblioteca: si hay que acordarse en qué carpeta quedó
      algo para poder encontrarlo, el buscador no sirve. */
  const resultados = useMemo(() => {
    if (!buscando) return [];
    const q = query.trim().toLowerCase();
    return builds.filter((build) => {
      if (roleFilter && build.role_id !== roleFilter) return false;
      if (tagFilter && !build.tags.includes(tagFilter)) return false;
      if (q && !build.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [builds, roleFilter, tagFilter, query, buscando]);

  function nuevaCarpeta(parentId: string | null) {
    const name = window.prompt("Nombre de la carpeta");
    if (!name?.trim()) return;
    startTransition(async () => {
      await createFolder(gameId, name, parentId);
      router.refresh();
    });
  }

  function nuevaBuild(folderId: string | null) {
    startTransition(async () => {
      await createBuild(gameId, folderId);
      router.refresh();
    });
  }

  async function pedirBorrarBuild(build: Build) {
    setConfirm({ tipo: "build", build, usos: await countBuildUsage(build.id) });
  }

  function listaDeBuilds(propias: Build[]) {
    return (
      <ul className="aparece-escalonado space-y-1.5">
        {propias.map((build) => (
          <li key={build.id}>
            <FilaBuild
              build={build}
              rolNombre={build.role_id ? roleById.get(build.role_id)?.name : undefined}
              carpetaNombre={
                buscando && build.folder_id
                  ? folderById.get(build.folder_id)?.name
                  : undefined
              }
              onEditar={() => setEditing(build)}
              onBorrar={() => pedirBorrarBuild(build)}
            />
          </li>
        ))}
      </ul>
    );
  }

  /** Las carpetas hijas de una, ya listas para la grilla. Se llama a sí misma
      a través de `panel`: una carpeta abierta arma la grilla de las suyas. */
  function carpetasDe(parentId: string | null): FichaDeCarpeta[] {
    return folders
      .filter((f) => f.parent_id === parentId)
      .map((f) => {
        const dentro = countFolderChildren(f.id, folders, builds);
        return {
          id: f.id,
          nombre: f.name,
          detalle: describir(dentro),
          panel: () => contenidoDeCarpeta(f.id),
          accion: (
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
              className="flex size-7 items-center justify-center rounded-lg bg-surface/90 text-muted transition-colors hover:text-danger"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          ),
        };
      });
  }

  /** Lo que se ve dentro de una carpeta abierta: sus subcarpetas y sus builds.
      Es una función que devuelve JSX y no un componente: un componente
      declarado acá adentro sería un tipo nuevo en cada pintada, y React
      remontaría la grilla perdiendo la animación de cierre a medio camino. */
  function contenidoDeCarpeta(folderId: string) {
    const subcarpetas = carpetasDe(folderId);
    const propias = builds.filter((b) => b.folder_id === folderId);

    return (
      <div className="space-y-3">
        {subcarpetas.length > 0 && (
          <GrillaCarpetas carpetas={subcarpetas} anidada />
        )}

        {propias.length > 0 ? (
          listaDeBuilds(propias)
        ) : (
          <p className="px-1 text-sm text-muted">
            {subcarpetas.length > 0
              ? "Todas las builds están en las subcarpetas."
              : "Esta carpeta está vacía."}
          </p>
        )}

        <BotonesDeCreacion
          onCarpeta={() => nuevaCarpeta(folderId)}
          onBuild={() => nuevaBuild(folderId)}
        />
      </div>
    );
  }

  const raiz = carpetasDe(null);
  const sueltas = builds.filter((b) => b.folder_id === null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Builds</h1>
        <p className="mt-1 text-sm text-muted">
          El color que le pongas a una build pinta la fila de esa persona en todas las
          composiciones donde la uses.
        </p>
      </div>

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
            onClick={() => nuevaCarpeta(null)}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
          >
            <FolderPlus size={15} aria-hidden />
            <span className="hidden sm:inline">Carpeta</span>
          </button>
          <button
            type="button"
            onClick={() => nuevaBuild(null)}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg hover:bg-accent-hover active:translate-y-px"
          >
            <Plus size={15} aria-hidden />
            Nueva build
          </button>
        </div>
      </div>

      {buscando ? (
        // Buscando no hay carpetas: los resultados vienen de toda la
        // biblioteca, y cada uno dice de qué carpeta salió.
        resultados.length === 0 ? (
          <Vacio>Ninguna build coincide con el filtro.</Vacio>
        ) : (
          listaDeBuilds(resultados)
        )
      ) : (
        <div className="space-y-4">
          {raiz.length > 0 && (
            <GrillaCarpetas carpetas={raiz} />
          )}

          {sueltas.length > 0 && listaDeBuilds(sueltas)}

          {raiz.length === 0 && sueltas.length === 0 && (
            <Vacio>
              Todavía no tenés builds ni carpetas. Creá la primera con los botones de
              arriba.
            </Vacio>
          )}
        </div>
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

/** «2 carpetas · 9 builds», que es lo que hace falta saber sin abrirla. */
function describir({ folders, builds }: { folders: number; builds: number }): string {
  const partes: string[] = [];
  if (folders > 0) partes.push(`${folders} carpeta${folders === 1 ? "" : "s"}`);
  if (builds > 0) partes.push(`${builds} build${builds === 1 ? "" : "s"}`);
  return partes.length > 0 ? partes.join(" · ") : "Vacía";
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}

function BotonesDeCreacion({
  onCarpeta,
  onBuild,
}: {
  onCarpeta: () => void;
  onBuild: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onBuild}
        className="flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <Plus size={15} aria-hidden />
        Nueva build acá
      </button>
      <button
        type="button"
        onClick={onCarpeta}
        className="flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <FolderPlus size={15} aria-hidden />
        Subcarpeta
      </button>
    </div>
  );
}

function FilaBuild({
  build,
  rolNombre,
  carpetaNombre,
  onEditar,
  onBorrar,
}: {
  build: Build;
  rolNombre: string | undefined;
  carpetaNombre: string | undefined;
  onEditar: () => void;
  onBorrar: () => void;
}) {
  return (
    <div
      className="flex min-h-14 flex-wrap items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
      style={
        build.color
          ? { background: tinteDeFila(build.color), borderColor: bordeDeFila(build.color) }
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
          {rolNombre ?? "Sin rol"}
          {carpetaNombre ? ` · ${carpetaNombre}` : ""}
          {build.tags.length > 0 && ` · ${build.tags.join(", ")}`}
        </p>
      </div>

      <button
        type="button"
        onClick={onEditar}
        className="h-9 shrink-0 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
      >
        Editar
      </button>
      <button
        type="button"
        onClick={onBorrar}
        aria-label={`Borrar ${build.name}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:text-danger"
      >
        <Trash2 size={15} aria-hidden />
      </button>
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
