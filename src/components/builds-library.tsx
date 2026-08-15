"use client";

import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";

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
  setFolderColor,
} from "@/app/actions/builds";
import {
  propsDeArrastre,
  useArrastrado,
  useZonaDeSoltar,
  type Arrastrado,
} from "@/components/arrastre";
import { BuildEditor } from "@/components/build-editor";
import { Desplegable } from "@/components/desplegable";
import { Flotante } from "@/components/flotante";
import { ColorPicker, type UsedColor } from "@/components/color-picker";
import { ItemIcon } from "@/components/item-icon";
import { MoverA, type Destino } from "@/components/mover-a";
import { esProvisional, idProvisional, useOptimista } from "@/components/optimista";
import {
  colorEfectivo,
  countFolderChildren,
  DISPOSICION_EQUIPO,
  type Build,
  type BuildFolder,
  type Role,
} from "@/lib/builds-shared";
import { textoSobre } from "@/lib/color";

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

/** Etiquetas de los casilleros vacíos del equipo. */
const SIGLAS: Record<string, string> = {
  mainhand: "Arma",
  offhand: "Off",
  head: "Cab",
  armor: "Pech",
  shoes: "Bot",
  cape: "Capa",
  food: "Com",
  potion: "Poc",
  mount: "Mont",
};

export function BuildsLibrary({
  gameId,
  folders: foldersDelServidor,
  builds: buildsDelServidor,
  roles,
}: {
  gameId: string;
  folders: BuildFolder[];
  builds: Build[];
  roles: Role[];
}) {
  // Todo lo que se toca acá tarda un viaje de red: crear, renombrar, pintar,
  // mover, borrar. Se muestra hecho y se confirma por atrás.
  const carpetasOpt = useOptimista<BuildFolder>(foldersDelServidor);
  const buildsOpt = useOptimista<Build>(buildsDelServidor);
  const folders = carpetasOpt.lista;
  const builds = buildsOpt.lista;

  const [abiertas, setAbiertas] = useState<Set<string>>(
    // Las de primer nivel arrancan abiertas: un árbol todo plegado no muestra
    // nada de lo que la persona vino a buscar.
    () =>
      new Set(
        foldersDelServidor.filter((f) => f.parent_id === null).map((f) => f.id),
      ),
  );
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
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
    if (parentId) abrir(parentId);
    carpetasOpt.agregar(
      {
        id: idProvisional(),
        parent_id: parentId,
        name: name.trim(),
        color: null,
        position: folders.length,
      },
      () => createFolder(gameId, name, parentId),
    );
  }

  function nuevaBuild(folderId: string | null) {
    if (folderId) abrir(folderId);
    setSeleccionada(folderId);
    buildsOpt.agregar(
      {
        id: idProvisional(),
        folder_id: folderId,
        name: "Build sin nombre",
        role_id: null,
        color: null,
        tags: [],
        items: {},
        notes: null,
        position: builds.length,
        updated_at: new Date().toISOString(),
      },
      () => createBuild(gameId, folderId),
    );
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

  function grillaDeBuilds(propias: Build[], conCarpeta: boolean) {
    return (
      <GrillaDeBuilds
        propias={propias}
        carpeta={conCarpeta ? undefined : seleccionada}
        colorDe={(build) => colorEfectivo(build, folders)}
        rolDe={(build) => (build.role_id ? roleById.get(build.role_id)?.name : undefined)}
        carpetaDe={(build) =>
          conCarpeta && build.folder_id ? folderById.get(build.folder_id)?.name : undefined
        }
        destinosDe={(build) => destinos(build.folder_id)}
        onMoverA={(buildId, destino) => {
          const carpeta = destino === RAIZ ? null : destino;
          buildsOpt.editar(buildId, { folder_id: carpeta }, () =>
            moveBuild(buildId, carpeta),
          );
        }}
        onReordenar={(orden) =>
          buildsOpt.hacer(() =>
            reorderBuilds(orden.map((b) => ({ id: b.id, position: b.position }))),
          )
        }
        onTraer={(buildId, carpeta) =>
          buildsOpt.editar(buildId, { folder_id: carpeta }, () =>
            moveBuild(buildId, carpeta),
          )
        }
        onEditar={setEditing}
        onBorrar={pedirBorrarBuild}
      />
    );
  }

  /**
   * El árbol de carpetas. Se llama a sí mismo por nivel.
   *
   * Solo carpetas: las builds ya no cuelgan de acá, viven en la columna ancha
   * de al lado. Mezclarlas dentro del árbol era lo que dejaba la tarjeta de una
   * build apretada contra el borde de una columna de un cuarto de pantalla.
   */
  function rama(parentId: string | null, nivel: number): React.ReactNode {
    const subcarpetas = folders.filter((f) => f.parent_id === parentId);

    return (
      <>
        {subcarpetas.map((f) => (
          <Fragment key={f.id}>
            <FilaCarpeta
              folder={f}
              creandose={esProvisional(f.id)}
              nivel={nivel}
              abierta={abiertas.has(f.id)}
              seleccionada={seleccionada === f.id}
              cuantas={countFolderChildren(f.id, folders, builds).builds}
              renombrando={renombrando === f.id}
              destinos={destinos(f.parent_id, f.id)}
              onAlternar={() => {
                setSeleccionada(f.id);
                alternar(f.id);
              }}
              onRenombrar={(nombre) => {
                setRenombrando(null);
                if (nombre !== f.name) {
                  carpetasOpt.editar(f.id, { name: nombre }, () =>
                    renameFolder(f.id, nombre),
                  );
                }
              }}
              color={f.color}
              usedColors={usedColors}
              onColor={(nuevo) =>
                carpetasOpt.editar(f.id, { color: nuevo }, () =>
                  setFolderColor(f.id, nuevo),
                )
              }
              onEmpezarRenombre={() => setRenombrando(f.id)}
              onCancelarRenombre={() => setRenombrando(null)}
              onMover={(destino) => {
                const padre = destino === RAIZ ? null : destino;
                carpetasOpt.editar(f.id, { parent_id: padre }, () =>
                  moveFolder(f.id, padre),
                );
              }}
              acepta={(dato) =>
                (dato.tipo === "build" && dato.origen !== f.id) ||
                (dato.tipo === "carpeta" &&
                  dato.id !== f.id &&
                  dato.origen !== f.id &&
                  !esAncestra(dato.id, f.id))
              }
              onSoltar={(dato) => {
                abrir(f.id);
                if (dato.tipo === "build") {
                  buildsOpt.editar(dato.id, { folder_id: f.id }, () =>
                    moveBuild(dato.id, f.id),
                  );
                }
                if (dato.tipo === "carpeta") {
                  carpetasOpt.editar(dato.id, { parent_id: f.id }, () =>
                    moveFolder(dato.id, f.id),
                  );
                }
              }}
              onNuevaBuild={() => nuevaBuild(f.id)}
              onNuevaCarpeta={() => nuevaCarpeta(f.id)}
              onBorrar={() => pedirBorrarCarpeta(f)}
            />

            {abiertas.has(f.id) && rama(f.id, nivel + 1)}
          </Fragment>
        ))}
      </>
    );
  }

  const deLaSeleccionada = buildsDe(seleccionada);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Builds</h1>
        <p className="mt-1 text-sm text-muted">
          El color que le pongas a una build pinta la fila de esa persona en todas las
          composiciones donde la uses.
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar en todas las carpetas…"
          aria-label="Buscar build"
          className="h-10 w-full min-w-44 rounded-lg border border-border bg-surface px-3 text-sm sm:w-56"
        />
        <Desplegable
          value={roleFilter}
          opciones={roles.map((r) => ({ value: r.id, label: r.name }))}
          onChange={setRoleFilter}
          etiqueta="Filtrar por rol"
          vacio="Todos los roles"
          className="h-10 w-40"
        />
        {allTags.length > 0 && (
          <Desplegable
            value={tagFilter}
            opciones={allTags.map((t) => ({ value: t, label: t }))}
            onChange={setTagFilter}
            etiqueta="Filtrar por tag"
            vacio="Todos los tags"
            className="h-10 w-40"
          />
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
          <div className="min-h-0 flex-1 overflow-y-auto">
            {grillaDeBuilds(resultados, true)}
          </div>
        )
      ) : (
        // Tres cuartos para las builds y un cuarto para el árbol. Las carpetas
        // se tocan de vez en cuando; las builds se miran todo el tiempo, así
        // que el ancho va donde está el trabajo.
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <div className="min-h-0 overflow-y-auto rounded-xl border border-border bg-surface p-2">
            <FilaRaiz
              seleccionada={seleccionada === null}
              cuantas={buildsDe(null).length}
              onSeleccionar={() => setSeleccionada(null)}
              acepta={(dato) =>
                (dato.tipo === "build" && dato.origen !== null) ||
                (dato.tipo === "carpeta" && dato.origen !== null)
              }
              onSoltar={(dato) => {
                if (dato.tipo === "build") {
                  buildsOpt.editar(dato.id, { folder_id: null }, () =>
                    moveBuild(dato.id, null),
                  );
                }
                if (dato.tipo === "carpeta") {
                  carpetasOpt.editar(dato.id, { parent_id: null }, () =>
                    moveFolder(dato.id, null),
                  );
                }
              }}
            />
            {rama(null, 0)}
          </div>

          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">
                {seleccionada ? folderById.get(seleccionada)?.name : "Fuera de toda carpeta"}
              </h2>
              <span className="text-sm text-muted">
                {deLaSeleccionada.length === 1
                  ? "1 build"
                  : `${deLaSeleccionada.length} builds`}
              </span>
              <button
                type="button"
                onClick={() => nuevaBuild(seleccionada)}
                className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-surface-2"
              >
                <Plus size={14} aria-hidden />
                Nueva build acá
              </button>
            </div>

            {deLaSeleccionada.length > 0 ? (
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {grillaDeBuilds(deLaSeleccionada, false)}
              </div>
            ) : (
              <Vacio>
                {seleccionada
                  ? "Esta carpeta no tiene builds. Creá la primera o arrastrá una desde otra."
                  : "No hay builds fuera de las carpetas. Elegí una carpeta a la izquierda."}
              </Vacio>
            )}
          </div>

        </div>
      )}

      {editing && (
        <BuildEditor
          build={editing}
          roles={roles}
          usedColors={usedColors}
          onClose={() => setEditing(null)}
          // El editor ya guardó cuando avisa; lo que falta es que la tarjeta
          // muestre lo nuevo sin esperar a que vuelva la pantalla entera.
          onSaved={(guardada) =>
            buildsOpt.editar(guardada.id, guardada, async () => undefined)
          }
        />
      )}

      {confirm && (
        <DialogoBorrado
          confirmacion={confirm}
          onCancel={() => setConfirm(null)}
          onBorrar={(rescatar) => {
            const actual = confirm;
            setConfirm(null);
            if (actual.tipo === "build") {
              buildsOpt.quitar(actual.build.id, () => deleteBuild(actual.build.id));
            } else {
              carpetasOpt.quitar(actual.folder.id, () =>
                deleteFolder(actual.folder.id, rescatar),
              );
            }
          }}
        />
      )}

      {(carpetasOpt.error || buildsOpt.error) && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {carpetasOpt.error ?? buildsOpt.error}
        </p>
      )}
    </div>
  );
}

/**
 * La grilla de tarjetas de una carpeta, con vista previa del reordenamiento.
 *
 * Mientras arrastrás, las tarjetas se corren de lugar para mostrar dónde va a
 * caer la que llevás, y la que llevás se ve apagada. Un simple resaltado del
 * destino no dice lo mismo: te obliga a imaginar el resultado en vez de verlo,
 * y con veinte builds imaginarlo cuesta.
 *
 * La zona para soltar es la grilla entera y no cada tarjeta. Así resuelve los
 * dos casos con el mismo gesto: si la build ya vivía acá es reordenar, y si
 * viene de otra carpeta es traerla.
 */
function GrillaDeBuilds({
  propias,
  carpeta,
  colorDe,
  rolDe,
  carpetaDe,
  destinosDe,
  onMoverA,
  onReordenar,
  onTraer,
  onEditar,
  onBorrar,
}: {
  propias: Build[];
  /** `undefined` en los resultados de búsqueda: ahí no hay orden que tocar. */
  carpeta: string | null | undefined;
  colorDe: (build: Build) => string | null;
  rolDe: (build: Build) => string | undefined;
  carpetaDe: (build: Build) => string | undefined;
  destinosDe: (build: Build) => Destino[];
  onMoverA: (buildId: string, destino: string) => void;
  onReordenar: (orden: Build[]) => void;
  onTraer: (buildId: string, carpeta: string | null) => void;
  onEditar: (build: Build) => void;
  onBorrar: (build: Build) => void;
}) {
  const arrastrado = useArrastrado();
  const [sobre, setSobre] = useState<string | null>(null);

  /**
   * El orden que ya soltaste, mientras el servidor lo confirma.
   *
   * Sin esto, al soltar se borra la vista previa y las tarjetas vuelven al
   * orden viejo hasta que llega la respuesta: se ve saltar todo, soltar, y
   * recién ahí acomodarse. No es demora inevitable del servidor, es que la
   * pantalla no se estaba quedando con lo que ya sabía.
   *
   * Se guardan los identificadores y no las builds. Cuando el servidor manda la
   * lista nueva, esta se aplica encima; y si el conjunto cambió —alguien agregó
   * o movió una build— deja de coincidir y se descarta sola.
   */
  const [ordenSoltado, setOrdenSoltado] = useState<{
    /** El orden nuevo, por identificador. */
    nuevo: string[];
    /** Y cómo venía del servidor cuando lo soltaste. */
    antes: string[];
  } | null>(null);

  const ordenable = carpeta !== undefined;
  /** La lista tal como se muestra: la del servidor, o la que soltaste recién. */
  const mostradas = useMemo(() => {
    if (!ordenSoltado) return propias;

    // Si el servidor ya manda un orden distinto del que había cuando soltaste,
    // se enteró: manda él. Soltar esto por tiempo no sirve, porque
    // `router.refresh()` no espera a nada.
    const delServidor = propias.map((b) => b.id);
    const cambio = delServidor.some((id, i) => id !== ordenSoltado.antes[i]);
    if (cambio || delServidor.length !== ordenSoltado.antes.length) return propias;

    const porId = new Map(propias.map((b) => [b.id, b]));
    const armado: Build[] = [];
    for (const id of ordenSoltado.nuevo) {
      const build = porId.get(id);
      if (build) armado.push(build);
    }
    return armado.length === propias.length ? armado : propias;
  }, [propias, ordenSoltado]);

  const suya =
    ordenable && arrastrado?.tipo === "build"
      ? mostradas.find((b) => b.id === arrastrado.id)
      : undefined;

  /**
   * El orden que quedaría si soltaras ahora: las dos tarjetas intercambiadas.
   *
   * Intercambiar y no insertar, y no es un detalle de gusto. Insertando, la
   * tarjeta que llevás se mete en el lugar de la otra y EMPUJA a todas las
   * siguientes; entonces debajo del cursor queda una tarjeta distinta, que pasa
   * a ser el nuevo destino, que vuelve a reordenar todo, y así sin parar. La
   * grilla entra en un ciclo de reacomodos que se traba, sobre todo yendo hacia
   * la izquierda, que es donde el empuje corre más elementos.
   *
   * Con un intercambio solo se mueven dos, y la que queda debajo del cursor es
   * la que estás arrastrando, que no cuenta como destino. El resultado se
   * queda quieto.
   */
  const previsualizado = useMemo(() => {
    if (!suya || !sobre || sobre === suya.id) return mostradas;
    const desde = mostradas.findIndex((b) => b.id === suya.id);
    const hasta = mostradas.findIndex((b) => b.id === sobre);
    if (desde < 0 || hasta < 0) return mostradas;

    const copia = [...mostradas];
    copia[desde] = mostradas[hasta];
    copia[hasta] = mostradas[desde];
    return copia;
  }, [mostradas, suya, sobre]);

  /** El destino solo cambia al entrar en OTRA tarjeta, nunca en la propia. */
  function marcarDestino(buildId: string) {
    if (!ordenable || !suya || buildId === suya.id) return;
    setSobre((previo) => (previo === buildId ? previo : buildId));
  }

  function soltar() {
    const dato = arrastrado;
    setSobre(null);
    if (!ordenable || dato?.tipo !== "build") return;

    // De otra carpeta: se trae. De esta: se reordena con lo que ya se ve.
    if (!mostradas.some((b) => b.id === dato.id)) {
      onTraer(dato.id, carpeta);
    } else if (previsualizado !== mostradas) {
      // Se fija primero lo que ya estabas viendo, y recién después se avisa al
      // servidor. Al revés, la pantalla parpadea entre los dos órdenes.
      setOrdenSoltado({
        nuevo: previsualizado.map((b) => b.id),
        antes: propias.map((b) => b.id),
      });
      onReordenar(previsualizado);
    }
  }

  return (
    <div
      onDragOver={(evento) => {
        if (ordenable && arrastrado?.tipo === "build") evento.preventDefault();
      }}
      onDrop={(evento) => {
        evento.preventDefault();
        soltar();
      }}
      onDragLeave={(evento) => {
        // Solo cuando el cursor sale de la grilla entera, no al cruzar de una
        // tarjeta a la de al lado.
        if (!evento.currentTarget.contains(evento.relatedTarget as Node)) setSobre(null);
      }}
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      {previsualizado.map((build) => (
        <TarjetaBuild
          key={build.id}
          build={build}
          color={colorDe(build)}
          rolNombre={rolDe(build)}
          carpetaNombre={carpetaDe(build)}
          destinos={destinosDe(build)}
          creandose={esProvisional(build.id)}
          fantasma={suya?.id === build.id}
          onSobre={() => marcarDestino(build.id)}
          onMover={(destino) => onMoverA(build.id, destino)}
          onEditar={() => onEditar(build)}
          onBorrar={() => onBorrar(build)}
        />
      ))}
    </div>
  );
}

/**
 * La raíz del árbol.
 *
 * Es una fila más y no un caso especial escondido: las builds que no están en
 * ninguna carpeta existen, y sin una fila que las represente no habría forma de
 * verlas ni de arrastrar algo de vuelta afuera.
 */
function FilaRaiz({
  seleccionada,
  cuantas,
  onSeleccionar,
  acepta,
  onSoltar,
}: {
  seleccionada: boolean;
  cuantas: number;
  onSeleccionar: () => void;
  acepta: (dato: Arrastrado) => boolean;
  onSoltar: (dato: Arrastrado) => void;
}) {
  const zona = useZonaDeSoltar(acepta, onSoltar);

  return (
    <button
      type="button"
      {...zona.props}
      onClick={onSeleccionar}
      className={`flex min-h-9 w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition-colors ${
        zona.encima
          ? "bg-accent/15 ring-1 ring-accent"
          : seleccionada
            ? "bg-surface-2"
            : "hover:bg-surface-2"
      }`}
    >
      <Folder size={15} className="shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm">Fuera de toda carpeta</span>
      {cuantas > 0 && (
        <span className="shrink-0 text-xs tabular-nums text-muted">{cuantas}</span>
      )}
    </button>
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
  creandose,
  nivel,
  abierta,
  seleccionada,
  cuantas,
  renombrando,
  destinos,
  color,
  usedColors,
  onColor,
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
  /** Todavía no existe en la base: sus acciones no tienen a qué apuntar. */
  creandose: boolean;
  nivel: number;
  abierta: boolean;
  seleccionada: boolean;
  cuantas: number;
  renombrando: boolean;
  destinos: Destino[];
  color: string | null;
  usedColors: UsedColor[];
  onColor: (color: string | null) => void;
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
      className={`group flex min-h-9 items-center gap-1 rounded-lg pr-1 ${
        zona.encima
          ? "bg-accent/15 ring-1 ring-accent"
          : seleccionada
            ? "bg-surface-2"
            : "hover:bg-surface-2"
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
          className={`shrink-0 text-muted ${abierta ? "rotate-90" : ""}`}
        />
        {/* El ícono lleva el color de la carpeta: es la única pista de que lo
            que hay adentro se va a pintar así. */}
        <span style={color ? { color } : undefined} className="shrink-0">
          {abierta ? (
            <FolderOpen size={15} className={color ? "" : "text-accent"} aria-hidden />
          ) : (
            <Folder size={15} className={color ? "" : "text-muted"} aria-hidden />
          )}
        </span>

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

      {creandose ? (
        <span className="shrink-0 pr-2 text-[11px] text-muted">Creando…</span>
      ) : (
      <div className="flex shrink-0 items-center opacity-0 focus-within:opacity-100 group-hover:opacity-100">
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
        <ColorDeCarpeta
          nombre={folder.name}
          color={color}
          usedColors={usedColors}
          onElegir={onColor}
        />
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
      )}
    </div>
  );
}

/**
 * El color de una carpeta.
 *
 * Se elige desde acá, sin entrar en la carpeta: es lo que permite pintar de una
 * vez todas las builds que tiene adentro, y las de sus subcarpetas.
 */
function ColorDeCarpeta({
  nombre,
  color,
  usedColors,
  onElegir,
}: {
  nombre: string;
  color: string | null;
  usedColors: UsedColor[];
  onElegir: (color: string | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  return (
    <span className="flex shrink-0 items-center">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={`Color de ${nombre}`}
        title="Color de la carpeta"
        className="flex size-7 items-center justify-center rounded text-muted transition-colors hover:text-text"
      >
        <span
          className="size-3.5 rounded-full ring-1 ring-inset ring-black/20"
          style={{ background: color ?? "transparent" }}
        >
          {!color && <Palette size={14} aria-hidden />}
        </span>
      </button>

      {abierto && (
        <Flotante ancla={boton} onCerrar={() => setAbierto(false)} alineacion="derecha" className="w-72 p-3">
          <p className="pb-2 text-[11px] font-medium text-muted">Color de la carpeta</p>
          {/* El mismo selector que dentro de una build: si la carpeta pinta sus
              builds, tiene que poder llegar al mismo color exacto. */}
          <ColorPicker value={color} onChange={(nuevo) => onElegir(nuevo)} used={usedColors} />
          {color && (
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                onElegir(null);
              }}
              className="mt-2 h-8 w-full rounded-lg border border-border text-xs text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              Sacarle el color
            </button>
          )}
        </Flotante>
      )}
    </span>
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
  creandose,
  color,
  rolNombre,
  carpetaNombre,
  destinos,
  fantasma,
  onSobre,
  onMover,
  onEditar,
  onBorrar,
}: {
  build: Build;
  /** Todavía no existe en la base: sus acciones no tienen a qué apuntar. */
  creandose: boolean;
  /** Ya resuelto por herencia: propio, o el de su carpeta. */
  color: string | null;
  rolNombre: string | undefined;
  carpetaNombre: string | undefined;
  destinos: Destino[];
  /** Es la que estás arrastrando: se muestra apagada en su lugar previsto. */
  fantasma: boolean;
  onSobre: () => void;
  onMover: (destinoId: string) => void;
  onEditar: () => void;
  onBorrar: () => void;
}) {
  const nota =
    build.notes && build.notes.length > LIMITE_NOTA
      ? `${build.notes.slice(0, LIMITE_NOTA).trimEnd()}…`
      : build.notes;

  // El color se pinta lleno, sin mezclar con el fondo. Mezclado se fundía con
  // la página y dejaba de servir para reconocer la build de lejos, que es todo
  // lo que este color tiene que hacer. Como puede ser cualquiera, el texto de
  // encima se elige por contraste y no a mano.
  const conColor = color !== null;
  const estilo = conColor ? { background: color, color: textoSobre(color) } : undefined;

  return (
    <div
      onDragEnter={onSobre}
      {...propsDeArrastre({ tipo: "build", id: build.id, origen: build.folder_id })}
      style={estilo}
      className={`flex cursor-grab flex-col gap-2 rounded-xl border p-3 active:cursor-grabbing ${
        conColor ? "border-current/25" : "border-border bg-surface"
      } ${fantasma ? "opacity-40 outline-2 outline-dashed outline-accent" : ""}`}
    >
      <div className="flex gap-2.5">
        {/* El equipo acomodado como el panel de personaje del juego. Quien
            juega reconoce la pieza por su lugar, sin leer ninguna etiqueta, y
            los huecos vacíos del panel original se respetan por lo mismo.

            Los casilleros no tienen separación Y ADEMÁS cada ícono se agranda
            un 12% dentro del suyo. El ícono del juego viene con bastante aire
            transparente alrededor: sin invadirlo, dos armas contiguas se ven
            separadas por un dedo aunque los casilleros estén pegados. Como lo
            que se invade es transparente, no se pisa nada dibujado. */}
        <div className="grid w-[10.5rem] shrink-0 grid-cols-3">
          {DISPOSICION_EQUIPO.flat().map((slot, indice) =>
            slot === null ? (
              <span key={`hueco-${indice}`} aria-hidden />
            ) : build.items[slot] ? (
              <ItemIcon
                key={slot}
                item={build.items[slot]}
                size={96}
                className="h-auto w-full scale-[1.12]"
              />
            ) : (
              <span
                key={slot}
                title={SIGLAS[slot]}
                className="m-1 flex aspect-square items-center justify-center rounded border border-dashed border-current/45 text-[9px] font-semibold leading-none opacity-80"
              >
                {SIGLAS[slot]}
              </span>
            ),
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="min-w-0">
            {/* Dos líneas en vez de una recortada: el nombre usa el alto, que
                sobra, en lugar de reclamar ancho, que es lo que necesitan los
                íconos. */}
            <p className="line-clamp-2 text-sm font-medium leading-tight" title={build.name}>
              {build.name}
            </p>
            <p className={`truncate text-xs ${conColor ? "font-medium opacity-90" : "text-muted"}`}>
              {rolNombre ?? "Sin rol"}
              {carpetaNombre ? ` · ${carpetaNombre}` : ""}
            </p>
          </div>

          {build.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {build.tags.map((tag) => (
                <li
                  key={tag}
                  className={`rounded-lg px-1.5 py-0.5 text-[11px] ${
                    conColor
                      ? "border border-current/50 font-medium"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* La descripción va abajo y a lo ancho de la tarjeta. Al costado del
          equipo entraba en una columna angosta y se cortaba a las cuatro
          palabras, con el resto de la tarjeta vacío. */}
      {nota && (
        <p className={`text-xs font-medium leading-snug ${conColor ? "opacity-90" : "text-muted"}`}>
          {nota}
        </p>
      )}

      <div className="mt-auto flex items-center gap-1 pt-1">
        {creandose && (
          <span className="flex-1 text-center text-xs opacity-70">Creando…</span>
        )}
        {!creandose && (
        <button
          type="button"
          onClick={onEditar}
          className={`h-8 flex-1 rounded-lg border text-sm transition-colors ${
            conColor ? "border-current/35 hover:bg-current/10" : "border-border/70 hover:bg-surface-2"
          }`}
        >
          Editar
        </button>
        )}
        {!creandose && (
          <MoverA
            etiqueta={`Mover ${build.name} a otra carpeta`}
            destinos={destinos}
            onMover={onMover}
          />
        )}
        {!creandose && (
        <button
          type="button"
          onClick={onBorrar}
          aria-label={`Borrar ${build.name}`}
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            conColor ? "opacity-70 hover:opacity-100" : "text-muted hover:text-danger"
          }`}
        >
          <Trash2 size={14} aria-hidden />
        </button>
        )}
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
  onBorrar,
}: {
  confirmacion: Confirmacion;
  onCancel: () => void;
  /** Cierra y saca la cosa de la pantalla; el borrado real viaja por atrás. */
  onBorrar: (rescatar: boolean) => void;
}) {
  const [texto, setTexto] = useState("");

  const conContenido =
    confirmacion.tipo === "carpeta" &&
    (confirmacion.subcarpetas > 0 || confirmacion.buildsDentro > 0);

  const nombre =
    confirmacion.tipo === "carpeta" ? confirmacion.folder.name : confirmacion.build.name;

  const puede = !conContenido || texto.trim() === nombre;

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
              onClick={() => onBorrar(true)}
              className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-surface-2"
            >
              Rescatar el contenido
            </button>
          )}

          <button
            type="button"
            onClick={() => onBorrar(false)}
            disabled={!puede}
            className="h-10 rounded-lg bg-danger px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            {conContenido ? "Borrar todo" : "Borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
