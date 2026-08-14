"use client";

import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";

import {
  countBuildUsage,
  createBuild,
  createFolder,
  deleteBuild,
  deleteFolder,
  moveBuild,
  moveFolder,
  renameFolder,
  reorderBuilds,
} from "@/app/actions/builds";
import {
  propsDeArrastre,
  useZonaDeSoltar,
  type Arrastrado,
} from "@/components/arrastre";
import { BuildEditor } from "@/components/build-editor";
import type { UsedColor } from "@/components/color-picker";
import { ItemIcon } from "@/components/item-icon";
import { MoverA, type Destino } from "@/components/mover-a";
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
 * Las carpetas son un árbol con sangría, como el explorador de un editor de
 * código: cada nivel entra un poco más a la derecha, y la forma de la sangría
 * dice dónde estás parado sin tener que leer una miga de pan. Antes eran fichas
 * cuadradas, y con carpetas dentro de carpetas eso obligaba a abrir una para
 * ver la siguiente, perdiendo de vista el camino.
 *
 * Las builds NO son filas del árbol: son tarjetas, en una grilla debajo de su
 * carpeta. Una build es equipo, color, rol, tags y una nota; todo eso en una
 * fila de una línea entraba recortado o no entraba.
 */

/** Marca «sacar de toda carpeta»: el menú necesita un valor, y `null` no sirve. */
const RAIZ = "__raiz__";

/** Cuánto se muestra de la nota antes de cortar. Una tarjeta no es un editor. */
const LIMITE_NOTA = 120;

/** Lo que se ve en la tarjeta. El resto del equipo está en el editor. */
const VISIBLES = ["mainhand", "offhand", "head", "armor", "shoes"] as const;

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

  const [abiertas, setAbiertas] = useState<Set<string>>(
    // Las de primer nivel arrancan abiertas: un árbol todo plegado no muestra
    // nada de lo que la persona vino a buscar.
    () => new Set(folders.filter((f) => f.parent_id === null).map((f) => f.id)),
  );
  const [renombrando, setRenombrando] = useState<string | null>(null);
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

  /** La ruta de cada carpeta, para distinguir tres «Gankeo» en tres ramas. */
  const rutaDe = useMemo(() => {
    const salida = new Map<string, string>();
    for (const folder of folders) {
      const partes: string[] = [];
      let actual = folder.parent_id;
      // Tope por si un dato inconsistente dejara un ciclo: sin esto el bucle
      // colgaría la pestaña en vez de mostrar una ruta incompleta.
      let vueltas = 0;
      while (actual && vueltas < 50) {
        const padre = folderById.get(actual);
        if (!padre) break;
        partes.unshift(padre.name);
        actual = padre.parent_id;
        vueltas += 1;
      }
      salida.set(folder.id, partes.join(" / "));
    }
    return salida;
  }, [folders, folderById]);

  function correr(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  function alternar(id: string) {
    setAbiertas((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function abrir(id: string) {
    setAbiertas((previo) => new Set([...previo, id]));
  }

  /** ¿`posible` está en la cadena de padres de `carpeta`? */
  function esAncestra(posible: string, carpeta: string): boolean {
    let actual = folderById.get(carpeta)?.parent_id ?? null;
    let vueltas = 0;
    while (actual && vueltas < 50) {
      if (actual === posible) return true;
      actual = folderById.get(actual)?.parent_id ?? null;
      vueltas += 1;
    }
    return false;
  }

  /** Los destinos posibles para algo que hoy vive en `origen`. */
  function destinos(origen: string | null, excluir?: string): Destino[] {
    const lista: Destino[] = folders
      .filter((f) => f.id !== origen && f.id !== excluir)
      .filter((f) => !excluir || !esAncestra(excluir, f.id))
      .map((f) => ({ id: f.id, nombre: f.name, ruta: rutaDe.get(f.id) || undefined }));

    // La raíz también es destino: sin esto, algo que entró a una carpeta no
    // puede volver a salir.
    if (origen !== null) lista.unshift({ id: RAIZ, nombre: "Fuera de toda carpeta" });
    return lista;
  }

  function buildsDe(folderId: string | null): Build[] {
    return builds.filter((b) => b.folder_id === folderId);
  }

  function nuevaCarpeta(parentId: string | null) {
    const name = window.prompt("Nombre de la carpeta");
    if (!name?.trim()) return;
    correr(async () => {
      await createFolder(gameId, name, parentId);
      if (parentId) abrir(parentId);
    });
  }

  function nuevaBuild(folderId: string | null) {
    correr(async () => {
      await createBuild(gameId, folderId);
      if (folderId) abrir(folderId);
    });
  }

  async function pedirBorrarBuild(build: Build) {
    setConfirm({ tipo: "build", build, usos: await countBuildUsage(build.id) });
  }

  function pedirBorrarCarpeta(folder: BuildFolder) {
    const dentro = countFolderChildren(folder.id, folders, builds);
    setConfirm({
      tipo: "carpeta",
      folder,
      subcarpetas: dentro.folders,
      buildsDentro: dentro.builds,
    });
  }

  /**
   * Soltar una build sobre otra.
   *
   * Si vienen de la misma carpeta es un reordenamiento: la arrastrada se mete
   * en el lugar de la otra. Si viene de otra carpeta es una mudanza. La misma
   * zona resuelve las dos porque para quien arrastra es el mismo gesto.
   */
  function soltarSobreBuild(arrastradaId: string, destino: Build) {
    const arrastrada = builds.find((b) => b.id === arrastradaId);
    if (!arrastrada || arrastrada.id === destino.id) return;

    if (arrastrada.folder_id !== destino.folder_id) {
      correr(() => moveBuild(arrastrada.id, destino.folder_id));
      return;
    }

    const lista = buildsDe(destino.folder_id).filter((b) => b.id !== arrastrada.id);
    const donde = lista.findIndex((b) => b.id === destino.id);
    lista.splice(donde, 0, arrastrada);
    correr(() => reorderBuilds(lista.map((b) => ({ id: b.id, position: b.position }))));
  }

  function grillaDeBuilds(propias: Build[], nivel: number, conCarpeta: boolean) {
    return (
      <div
        className="aparece-escalonado grid gap-2.5 py-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        style={{ marginLeft: nivel * 18 + 6 }}
      >
        {propias.map((build) => (
          <TarjetaBuild
            key={build.id}
            build={build}
            rolNombre={build.role_id ? roleById.get(build.role_id)?.name : undefined}
            carpetaNombre={
              conCarpeta && build.folder_id
                ? folderById.get(build.folder_id)?.name
                : undefined
            }
            destinos={destinos(build.folder_id)}
            onMover={(destino) =>
              correr(() => moveBuild(build.id, destino === RAIZ ? null : destino))
            }
            onSoltarBuild={conCarpeta ? undefined : (id) => soltarSobreBuild(id, build)}
            onEditar={() => setEditing(build)}
            onBorrar={() => pedirBorrarBuild(build)}
          />
        ))}
      </div>
    );
  }

  /** Una carpeta y todo lo que cuelga de ella. Se llama a sí misma por nivel. */
  function rama(parentId: string | null, nivel: number): React.ReactNode {
    const subcarpetas = folders.filter((f) => f.parent_id === parentId);
    const propias = buildsDe(parentId);

    return (
      <>
        {subcarpetas.map((f) => (
          <Fragment key={f.id}>
            <FilaCarpeta
              folder={f}
              nivel={nivel}
              abierta={abiertas.has(f.id)}
              cuantas={countFolderChildren(f.id, folders, builds).builds}
              renombrando={renombrando === f.id}
              destinos={destinos(f.parent_id, f.id)}
              onAlternar={() => alternar(f.id)}
              onRenombrar={(nombre) => {
                setRenombrando(null);
                if (nombre !== f.name) correr(() => renameFolder(f.id, nombre));
              }}
              onEmpezarRenombre={() => setRenombrando(f.id)}
              onCancelarRenombre={() => setRenombrando(null)}
              onMover={(destino) =>
                correr(() => moveFolder(f.id, destino === RAIZ ? null : destino))
              }
              acepta={(dato) =>
                (dato.tipo === "build" && dato.origen !== f.id) ||
                (dato.tipo === "carpeta" &&
                  dato.id !== f.id &&
                  dato.origen !== f.id &&
                  !esAncestra(dato.id, f.id))
              }
              onSoltar={(dato) => {
                abrir(f.id);
                if (dato.tipo === "build") correr(() => moveBuild(dato.id, f.id));
                if (dato.tipo === "carpeta") correr(() => moveFolder(dato.id, f.id));
              }}
              onNuevaBuild={() => nuevaBuild(f.id)}
              onNuevaCarpeta={() => nuevaCarpeta(f.id)}
              onBorrar={() => pedirBorrarCarpeta(f)}
            />

            {abiertas.has(f.id) && rama(f.id, nivel + 1)}
          </Fragment>
        ))}

        {propias.length > 0 && grillaDeBuilds(propias, nivel, false)}
      </>
    );
  }

  const hayAlgo = folders.length > 0 || builds.length > 0;

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
            className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-surface-2"
          >
            <FolderPlus size={15} aria-hidden />
            <span className="hidden sm:inline">Carpeta</span>
          </button>
          <button
            type="button"
            onClick={() => nuevaBuild(null)}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover active:translate-y-px"
          >
            <Plus size={15} aria-hidden />
            Nueva build
          </button>
        </div>
      </div>

      {buscando ? (
        resultados.length === 0 ? (
          <Vacio>Ninguna build coincide con el filtro.</Vacio>
        ) : (
          grillaDeBuilds(resultados, 0, true)
        )
      ) : hayAlgo ? (
        <div className="rounded-xl border border-border bg-surface p-2">
          {rama(null, 0)}
        </div>
      ) : (
        <Vacio>
          Todavía no tenés builds ni carpetas. Creá la primera con los botones de arriba.
        </Vacio>
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

/**
 * Una carpeta en el árbol.
 *
 * La sangría es un margen y no caracteres de relleno: así el nombre se puede
 * seleccionar y copiar sin arrastrar espacios, y la fila entera sigue siendo
 * zona para soltar aunque el texto sea corto.
 */
function FilaCarpeta({
  folder,
  nivel,
  abierta,
  cuantas,
  renombrando,
  destinos,
  onAlternar,
  onRenombrar,
  onEmpezarRenombre,
  onCancelarRenombre,
  onMover,
  acepta,
  onSoltar,
  onNuevaBuild,
  onNuevaCarpeta,
  onBorrar,
}: {
  folder: BuildFolder;
  nivel: number;
  abierta: boolean;
  cuantas: number;
  renombrando: boolean;
  destinos: Destino[];
  onAlternar: () => void;
  onRenombrar: (nombre: string) => void;
  onEmpezarRenombre: () => void;
  onCancelarRenombre: () => void;
  onMover: (destinoId: string) => void;
  acepta: (dato: Arrastrado) => boolean;
  onSoltar: (dato: Arrastrado) => void;
  onNuevaBuild: () => void;
  onNuevaCarpeta: () => void;
  onBorrar: () => void;
}) {
  const zona = useZonaDeSoltar(acepta, onSoltar);

  return (
    <div
      {...zona.props}
      {...propsDeArrastre({ tipo: "carpeta", id: folder.id, origen: folder.parent_id })}
      style={{ paddingLeft: nivel * 18 + 4 }}
      className={`group flex min-h-9 items-center gap-1 rounded-lg pr-1 transition-colors ${
        zona.encima ? "bg-accent/15 ring-1 ring-accent" : "hover:bg-surface-2"
      }`}
    >
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
      >
        <ChevronRight
          size={14}
          aria-hidden
          className={`shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none ${
            abierta ? "rotate-90" : ""
          }`}
        />
        {abierta ? (
          <FolderOpen size={15} className="shrink-0 text-accent" aria-hidden />
        ) : (
          <Folder size={15} className="shrink-0 text-muted" aria-hidden />
        )}

        {renombrando ? (
          <input
            autoFocus
            defaultValue={folder.name}
            maxLength={60}
            onClick={(event) => event.stopPropagation()}
            onBlur={(event) => onRenombrar(event.target.value.trim() || folder.name)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") onCancelarRenombre();
            }}
            className="min-w-0 flex-1 rounded border border-accent bg-surface px-1.5 py-0.5 text-sm"
          />
        ) : (
          <span className="truncate text-sm">{folder.name}</span>
        )}

        {cuantas > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-muted">{cuantas}</span>
        )}
      </button>

      <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={onNuevaBuild}
          aria-label={`Nueva build en ${folder.name}`}
          title="Nueva build acá"
          className="flex size-7 items-center justify-center rounded text-muted transition-colors hover:text-text"
        >
          <Plus size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNuevaCarpeta}
          aria-label={`Nueva subcarpeta en ${folder.name}`}
          title="Nueva subcarpeta"
          className="flex size-7 items-center justify-center rounded text-muted transition-colors hover:text-text"
        >
          <FolderPlus size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onEmpezarRenombre}
          aria-label={`Renombrar ${folder.name}`}
          title="Renombrar"
          className="flex size-7 items-center justify-center rounded text-muted transition-colors hover:text-text"
        >
          <Pencil size={13} aria-hidden />
        </button>
        <MoverA
          etiqueta={`Mover la carpeta ${folder.name}`}
          destinos={destinos}
          onMover={onMover}
        />
        <button
          type="button"
          onClick={onBorrar}
          aria-label={`Borrar ${folder.name}`}
          title="Borrar"
          className="flex size-7 items-center justify-center rounded text-muted transition-colors hover:text-danger"
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * Una build, como tarjeta.
 *
 * El color de la build pinta la tarjeta entera: es el mismo color que después
 * pinta su fila en cada composición donde aparezca, así que reconocerla acá es
 * reconocerla allá.
 */
function TarjetaBuild({
  build,
  rolNombre,
  carpetaNombre,
  destinos,
  onMover,
  onSoltarBuild,
  onEditar,
  onBorrar,
}: {
  build: Build;
  rolNombre: string | undefined;
  carpetaNombre: string | undefined;
  destinos: Destino[];
  onMover: (destinoId: string) => void;
  /** Ausente en los resultados de búsqueda: ahí no hay una carpeta que ordenar. */
  onSoltarBuild?: (buildId: string) => void;
  onEditar: () => void;
  onBorrar: () => void;
}) {
  const zona = useZonaDeSoltar(
    (dato) => Boolean(onSoltarBuild) && dato.tipo === "build" && dato.id !== build.id,
    (dato) => onSoltarBuild?.(dato.id),
  );

  const nota =
    build.notes && build.notes.length > LIMITE_NOTA
      ? `${build.notes.slice(0, LIMITE_NOTA).trimEnd()}…`
      : build.notes;

  return (
    <div
      {...zona.props}
      {...propsDeArrastre({ tipo: "build", id: build.id, origen: build.folder_id })}
      className={`flex cursor-grab flex-col gap-2 rounded-xl border p-2.5 transition-shadow active:cursor-grabbing ${
        zona.encima ? "ring-2 ring-accent" : ""
      }`}
      style={
        build.color
          ? { background: tinteDeFila(build.color), borderColor: bordeDeFila(build.color) }
          : { borderColor: "var(--border)" }
      }
    >
      <div className="flex gap-1">
        {VISIBLES.map((slot) =>
          build.items[slot] ? (
            <ItemIcon key={slot} item={build.items[slot]} size={44} />
          ) : (
            <span
              key={slot}
              className="size-11 shrink-0 rounded-lg border border-dashed border-border"
            />
          ),
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate font-medium" title={build.name}>
          {build.name}
        </p>
        <p className="truncate text-xs text-muted">
          {rolNombre ?? "Sin rol"}
          {carpetaNombre ? ` · ${carpetaNombre}` : ""}
        </p>
      </div>

      {build.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {build.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-lg bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {nota && <p className="text-xs leading-snug text-muted">{nota}</p>}

      <div className="mt-auto flex items-center gap-1 pt-1">
        <button
          type="button"
          onClick={onEditar}
          className="h-8 flex-1 rounded-lg border border-border/70 text-sm transition-colors hover:bg-surface-2"
        >
          Editar
        </button>
        <MoverA
          etiqueta={`Mover ${build.name} a otra carpeta`}
          destinos={destinos}
          onMover={onMover}
        />
        <button
          type="button"
          onClick={onBorrar}
          aria-label={`Borrar ${build.name}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-danger"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
      {children}
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
