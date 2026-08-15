"use client";

import {
  ChevronLeft,
  ChevronRight,
  Crown,
  GripVertical,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  addGroup,
  addSlot,
  deleteGroup,
  deleteSlot,
  emptyComposition,
  setLeader,
  swapGroups,
  swapSlots,
  updateComposition,
  updateGroup,
  updateSlot,
} from "@/app/actions/compositions";
import {
  loQueSeArrastra,
  propsDeArrastre,
  useArrastrado,
  useZonaDeSoltar,
} from "@/components/arrastre";
import { BuildPeek } from "@/components/build-peek";
import { Desplegable } from "@/components/desplegable";
import { SelectorDeBuild } from "@/components/selector-de-build";
import { CompHeader } from "@/components/comp-header";
import { colorEfectivo, type Build, type BuildFolder, type Role } from "@/lib/builds-shared";
import { textoSobre } from "@/lib/color";
import {
  contarConfirmados,
  contarLugares,
  MAX_POR_GRUPO,
  type CompGroup,
  type CompSlot,
  type Composition,
} from "@/lib/compositions-shared";
import { tinteDeFila } from "@/lib/color";

/**
 * Editor de composición.
 *
 * Dos grupos por fila como máximo, y de ahí para abajo. Un grupo son 20
 * personas: tres en fila dejarían cada columna tan angosta que no entraría ni
 * el nombre, y en un monitor normal obligarían a scrollear de lado.
 */
export function CompositionEditor({
  composition,
  builds,
  folders,
  roles,
}: {
  composition: Composition;
  builds: Build[];
  folders: BuildFolder[];
  roles: Role[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [vaciando, setVaciando] = useState(false);

  const buildById = useMemo(() => new Map(builds.map((b) => [b.id, b])), [builds]);

  /* --- Vista previa del intercambio ----------------------------------------
     Arrastrar una fila sobre otra las intercambia. Mientras el cursor está
     encima, las dos filas ya se muestran como van a quedar: no hay que
     imaginar el resultado, se ve. Lo que se intercambia es solo lo que se
     MUESTRA; los identificadores y las acciones siguen siendo los de cada
     fila real, así soltar en el lugar equivocado no puede escribir en la
     persona equivocada. */
  const arrastrado = useArrastrado();
  const [sobre, setSobre] = useState<string | null>(null);

  /** El intercambio ya soltado, mientras el servidor lo confirma. Sin esto las
      dos filas vuelven a su contenido viejo al soltar y recién después cambian:
      se ve el salto de ida y vuelta. */
  const [soltado, setSoltado] = useState<{ a: string; b: string } | null>(null);

  const slotsPorId = useMemo(
    () =>
      new Map(
        composition.groups.flatMap((g) => g.slots.map((s) => [s.id, s] as const)),
      ),
    [composition],
  );

  function contenidoDe(slot: CompSlot): CompSlot {
    // Mientras arrastrás manda lo que estás por hacer; al soltar, lo que ya
    // hiciste. Las dos son el mismo intercambio de a dos filas.
    const par =
      arrastrado?.tipo === "lugar" && sobre && arrastrado.id !== sobre
        ? { a: arrastrado.id, b: sobre }
        : soltado;
    if (!par) return slot;

    if (slot.id === par.a) return slotsPorId.get(par.b) ?? slot;
    if (slot.id === par.b) return slotsPorId.get(par.a) ?? slot;
    return slot;
  }

  function intercambiar(a: string, b: string) {
    setSoltado({ a, b });
    startTransition(async () => {
      await swapSlots(a, b);
      router.refresh();
      setSoltado(null);
    });
  }

  const confirmados = contarConfirmados(composition);
  const lugares = contarLugares(composition);
  const bloqueado = composition.is_archived;

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="min-w-0">
          <input
            defaultValue={composition.name}
            disabled={bloqueado}
            aria-label="Nombre de la composición"
            onBlur={(event) =>
              event.target.value !== composition.name &&
              run(() => updateComposition(composition.id, { name: event.target.value }))
            }
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold hover:border-border focus:border-border disabled:opacity-70"
          />
          <input
            defaultValue={composition.description ?? ""}
            disabled={bloqueado}
            aria-label="Descripción"
            placeholder="Alianza Garcia vs Alianza Guerreros — 20:30 en Martlock"
            onBlur={(event) =>
              run(() =>
                updateComposition(composition.id, { description: event.target.value }),
              )
            }
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-muted hover:border-border focus:border-border disabled:opacity-70"
          />
          <p className="px-2 text-xs text-muted">
            {formatearFecha(composition.event_at, composition.event_tz)}
            {bloqueado && " · archivada, solo lectura"}
          </p>
        </div>

        <CompHeader
          compositionId={composition.id}
          confirmados={confirmados}
          lugares={lugares}
          shareSlug={composition.share_slug}
          visibility={composition.visibility}
          bloqueado={bloqueado}
          onArchivar={() =>
            run(() =>
              updateComposition(composition.id, { is_archived: !composition.is_archived }),
            )
          }
          onVaciar={() => setVaciando(true)}
        />
      </header>

      {/* Dos grupos por fila desde pantallas grandes; uno en el resto. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {composition.groups.map((group, indice) => {
          const anterior = composition.groups[indice - 1];
          const siguiente = composition.groups[indice + 1];
          return (
            <TarjetaGrupo
              key={group.id}
              group={group}
              builds={builds}
              roles={roles}
              buildById={buildById}
              folders={folders}
              bloqueado={bloqueado}
              onRun={run}
              contenidoDe={contenidoDe}
              onSobre={setSobre}
              onIntercambiar={intercambiar}
              enVuelo={arrastrado?.tipo === "lugar" ? arrastrado.id : null}
              onAdelantar={
                anterior && (() => run(() => swapGroups(group, anterior)))
              }
              onAtrasar={
                siguiente && (() => run(() => swapGroups(group, siguiente)))
              }
              onSoltarGrupo={(otro) => run(() => swapGroups(group, otro))}
            />
          );
        })}

        {!bloqueado && (
          <button
            type="button"
            onClick={() => run(() => addGroup(composition.id))}
            className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted transition-colors hover:border-accent hover:text-text"
          >
            <Plus size={16} aria-hidden />
            Agregar grupo
          </button>
        )}
      </div>

      {vaciando && (
        <DialogoVaciar
          nombre={composition.name}
          onCancel={() => setVaciando(false)}
          onConfirm={() => {
            setVaciando(false);
            run(() => emptyComposition(composition.id));
          }}
        />
      )}
    </div>
  );
}

function TarjetaGrupo({
  group,
  builds,
  roles,
  buildById,
  folders,
  bloqueado,
  onRun,
  contenidoDe,
  onSobre,
  onIntercambiar,
  enVuelo,
  onAdelantar,
  onAtrasar,
  onSoltarGrupo,
}: {
  group: CompGroup;
  builds: Build[];
  roles: Role[];
  buildById: Map<string, Build>;
  folders: BuildFolder[];
  bloqueado: boolean;
  onRun: (fn: () => Promise<unknown>) => void;
  /** Qué mostrar en cada fila mientras hay un arrastre en curso. */
  contenidoDe: (slot: CompSlot) => CompSlot;
  onSobre: (slotId: string | null) => void;
  onIntercambiar: (a: string, b: string) => void;
  /** El lugar que se está arrastrando, para mostrarlo apagado. */
  enVuelo: string | null;
  /** `undefined` cuando ya es el primero o el último. */
  onAdelantar: (() => void) | undefined;
  onAtrasar: (() => void) | undefined;
  onSoltarGrupo: (otro: { id: string; position: number }) => void;
}) {
  const confirmados = group.slots.filter((s) => (s.player_name ?? "").trim() !== "").length;

  // Soltar un grupo sobre otro los intercambia. Se toma por el encabezado y no
  // por la tarjeta entera: adentro hay veinte filas con campos que hay que
  // poder seleccionar con el mouse sin que se dispare un arrastre.
  const zona = useZonaDeSoltar(
    (dato) => dato.tipo === "grupo" && dato.id !== group.id,
    (dato) => {
      if (dato.tipo === "grupo") onSoltarGrupo({ id: dato.id, position: dato.position });
    },
  );

  return (
    <section
      {...zona.props}
      className={`flex flex-col rounded-xl border bg-surface ${
        zona.encima ? "border-accent ring-2 ring-accent" : "border-border"
      }`}
    >
      <header
        {...(bloqueado
          ? {}
          : propsDeArrastre({ tipo: "grupo", id: group.id, position: group.position }))}
        className={`flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 ${
          bloqueado ? "" : "cursor-grab active:cursor-grabbing"
        }`}
      >
        <input
          defaultValue={group.name ?? ""}
          disabled={bloqueado}
          placeholder="Grupo"
          aria-label="Nombre del grupo"
          onBlur={(event) => onRun(() => updateGroup(group.id, { name: event.target.value }))}
          className="w-28 rounded border border-transparent bg-transparent px-1 py-0.5 font-medium hover:border-border focus:border-border"
        />
        {group.guild_name !== null && (
          <input
            defaultValue={group.guild_name}
            disabled={bloqueado}
            placeholder="Gremio"
            aria-label="Gremio"
            onBlur={(event) =>
              onRun(() => updateGroup(group.id, { guild_name: event.target.value }))
            }
            className="w-28 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs"
          />
        )}
        <span
          className="flex items-center gap-1 text-xs tabular-nums text-muted"
          title={`${confirmados} de ${group.slots.length} lugares con nombre`}
        >
          <User size={13} aria-hidden />
          {confirmados}/{group.slots.length}
        </span>

        {!bloqueado && (
          <div className="ml-auto flex items-center gap-0.5">
            {/* Reordenar de a un lugar. Un grupo son veinte personas: mover el
                bloque entero es lo que se hace cuando la comp ya está armada y
                cambia quién entra primero. */}
            <button
              type="button"
              onClick={onAdelantar}
              disabled={!onAdelantar}
              aria-label={`Adelantar ${group.name ?? "el grupo"}`}
              title="Adelantar"
              className="flex size-8 items-center justify-center rounded text-muted transition-colors hover:text-text disabled:opacity-25 disabled:hover:text-muted"
            >
              <ChevronLeft size={15} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onAtrasar}
              disabled={!onAtrasar}
              aria-label={`Atrasar ${group.name ?? "el grupo"}`}
              title="Atrasar"
              className="flex size-8 items-center justify-center rounded text-muted transition-colors hover:text-text disabled:opacity-25 disabled:hover:text-muted"
            >
              <ChevronRight size={15} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onRun(() => deleteGroup(group.id))}
              aria-label={`Borrar ${group.name ?? "grupo"}`}
              className="flex size-8 items-center justify-center rounded text-muted transition-colors hover:text-danger"
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        )}
      </header>

      <ul className="divide-y divide-border/70">
        {group.slots.map((slot) => {
          const visto = contenidoDe(slot);
          const build = visto.build_id ? buildById.get(visto.build_id) : undefined;
          // El mismo color, sin mezclar, que el de la tarjeta en la biblioteca:
          // si acá se atenuara, la misma build parecería dos builds distintas.
          const color = build ? colorEfectivo(build, folders) : null;
          const pintada = color !== null;
          const estilo = pintada
            ? { background: color, color: textoSobre(color) }
            : undefined;

          // Los campos conservan SIEMPRE el fondo de la página. Transparentes
          // sobre el color de la build se volvían ilegibles con cada color
          // distinto, y encima el texto que se escribe adentro no es de la
          // build: es del jugador.
          const campo = "border-border bg-surface text-text";

          return (
            <SlotFila
              key={slot.id}
              slot={slot}
              visto={visto}
              folders={folders}
              apagada={enVuelo === slot.id}
              onSobre={onSobre}
              onIntercambiar={onIntercambiar}
              grupoId={group.id}
              build={build}
              estilo={estilo}
              pintada={pintada}
              campo={campo}
              builds={builds}
              roles={roles}
              bloqueado={bloqueado}
              onRun={onRun}
            />
          );
        })}
      </ul>

      {!bloqueado && group.slots.length < MAX_POR_GRUPO && (
        <button
          type="button"
          onClick={() => onRun(() => addSlot(group.id))}
          className="flex h-10 items-center gap-2 rounded-b-xl px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Plus size={15} aria-hidden />
          Agregar persona
        </button>
      )}
    </section>
  );
}

/**
 * Una persona dentro de un grupo.
 *
 * La manija de la izquierda arrastra la fila entera: build, rol, nombre y nota
 * viajan juntos a donde la sueltes, en este grupo o en otro. Se intercambia el
 * CONTENIDO de los dos lugares y no las filas, así cada grupo conserva su
 * cantidad de lugares.
 */
function SlotFila({
  slot,
  visto,
  folders,
  apagada,
  onSobre,
  onIntercambiar,
  grupoId,
  build,
  estilo,
  pintada,
  campo,
  builds,
  roles,
  bloqueado,
  onRun,
}: {
  slot: CompSlot;
  /** Lo que se muestra: durante un arrastre puede ser el de otra fila. */
  visto: CompSlot;
  folders: BuildFolder[];
  apagada: boolean;
  onSobre: (slotId: string | null) => void;
  onIntercambiar: (a: string, b: string) => void;
  grupoId: string;
  build: Build | undefined;
  estilo: React.CSSProperties | undefined;
  pintada: boolean;
  campo: string;
  builds: Build[];
  roles: Role[];
  bloqueado: boolean;
  onRun: (fn: () => Promise<unknown>) => void;
}) {
  const zona = useZonaDeSoltar(
    (dato) => dato.tipo === "lugar" && dato.id !== slot.id,
    (dato) => {
      onSobre(null);
      onIntercambiar(dato.id, slot.id);
    },
  );

  return (
    <li
      {...zona.props}
      onDragEnter={(evento) => {
        zona.props.onDragEnter();
        if (loQueSeArrastra()?.tipo === "lugar") onSobre(slot.id);
        evento.preventDefault();
      }}
      style={estilo}
      className={`flex items-center gap-1.5 px-1 py-1 ${
        apagada ? "opacity-40" : ""
      } ${zona.encima ? "ring-2 ring-inset ring-accent" : ""}`}
    >
      {!bloqueado && (
        <span
          {...propsDeArrastre({ tipo: "lugar", id: slot.id })}
          title="Arrastrar para cambiar de lugar"
          aria-hidden
          className={`flex size-6 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing ${
            pintada ? "opacity-50 hover:opacity-100" : "text-border hover:text-muted"
          }`}
        >
          <GripVertical size={14} />
        </span>
      )}

      {/* La corona: una sola por grupo. Tocar la de otra persona se la pasa;
          tocar la propia no la saca, porque un grupo sin caller no es un
          estado que sirva para nada. */}
      <button
        type="button"
        title={slot.is_leader ? "Tiene la corona" : "Darle la corona"}
        aria-label={slot.is_leader ? "Tiene la corona" : "Darle la corona"}
        aria-pressed={slot.is_leader}
        disabled={bloqueado || slot.is_leader}
        onClick={() => onRun(() => setLeader(grupoId, slot.id))}
        className={`flex size-7 shrink-0 items-center justify-center rounded ${
          slot.is_leader
            ? pintada
              ? "opacity-100"
              : "text-accent"
            : pintada
              ? "opacity-0 hover:opacity-70 focus-visible:opacity-70"
              : "text-border hover:text-muted"
        }`}
      >
        {/* Contorno oscuro finito: sin él una corona blanca sobre un fondo
            claro desaparece, que es justo cuando más se la busca. */}
        <Crown
          size={15}
          fill={slot.is_leader ? "currentColor" : "none"}
          stroke="#101013"
          strokeWidth={1.5}
        />
      </button>

      <BuildPeek build={build} />

      <SelectorDeBuild
        value={visto.build_id}
        builds={builds}
        folders={folders}
        onChange={(id) => onRun(() => updateSlot(slot.id, { build_id: id }))}
        disabled={bloqueado}
        className="h-8 w-24 shrink-0 sm:w-36"
      />

      <Desplegable
        value={visto.role_id ?? ""}
        opciones={roles.map((r) => ({ value: r.id, label: r.name }))}
        onChange={(v) => onRun(() => updateSlot(slot.id, { role_id: v || null }))}
        etiqueta="Rol"
        vacio="Rol…"
        disabled={bloqueado}
        className="hidden h-8 w-24 shrink-0 sm:block"
      />

      <input
        // La `key` fuerza a redibujarlo cuando la vista previa cambia lo que
        // tiene que mostrar: un campo no controlado se queda con su valor
        // inicial y mostraría el nombre de la otra persona.
        key={visto.id + (visto.player_name ?? "")}
        defaultValue={visto.player_name ?? ""}
        disabled={bloqueado}
        placeholder="Nombre"
        aria-label="Nombre del jugador"
        onBlur={(event) =>
          onRun(() => updateSlot(slot.id, { player_name: event.target.value }))
        }
        className={`h-8 min-w-0 flex-1 rounded border px-2 text-xs ${campo}`}
      />

      {!bloqueado && (
        <button
          type="button"
          onClick={() => onRun(() => deleteSlot(slot.id))}
          aria-label="Quitar persona"
          className={`flex size-7 shrink-0 items-center justify-center rounded ${
            pintada ? "opacity-60 hover:opacity-100" : "text-muted hover:text-danger"
          }`}
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </li>
  );
}

/**
 * Doble confirmación para vaciar.
 *
 * El segundo paso pide escribir el nombre. Un segundo «¿estás seguro?» igual al
 * primero se clickea en piloto automático; escribir el nombre, no.
 */
function DialogoVaciar({
  nombre,
  onCancel,
  onConfirm,
}: {
  nombre: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [texto, setTexto] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Vaciar ${nombre}`}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Vaciar «{nombre}»</h2>

        {paso === 1 ? (
          <>
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <strong className="text-success">Se conserva</strong> la estructura: los
                grupos, los lugares y el rol de cada uno.
              </p>
              <p>
                <strong className="text-danger">Se borra</strong> la build, el nombre y
                las notas de cada persona.
              </p>
              <p className="text-muted">Esto no se puede deshacer.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setPaso(2)}
                className="h-10 rounded-lg bg-danger px-4 text-sm font-medium text-white"
              >
                Continuar
              </button>
            </div>
          </>
        ) : (
          <>
            <label htmlFor="confirmar-vaciar" className="mt-3 block text-sm text-muted">
              Para confirmar, escribí el nombre de la composición.
            </label>
            <input
              id="confirmar-vaciar"
              autoFocus
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder={nombre}
              className="mt-2 h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={texto.trim() !== nombre}
                className="h-10 rounded-lg bg-danger px-4 text-sm font-medium text-white disabled:opacity-40"
              >
                Vaciar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatearFecha(iso: string, tz: string): string {
  try {
    const texto = new Intl.DateTimeFormat("es-AR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: tz,
    }).format(new Date(iso));
    return `${texto} (${tz.split("/").pop()?.replace(/_/g, " ")})`;
  } catch {
    return new Date(iso).toLocaleString("es-AR");
  }
}
