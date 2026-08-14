"use client";

import { ChevronLeft, ChevronRight, Plus, Star, Trash2, X } from "lucide-react";
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
  updateComposition,
  updateGroup,
  updateSlot,
} from "@/app/actions/compositions";
import { BuildPeek } from "@/components/build-peek";
import { CompHeader } from "@/components/comp-header";
import type { Build, Role } from "@/lib/builds-shared";
import {
  contarConfirmados,
  contarLugares,
  MAX_POR_GRUPO,
  type CompGroup,
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
  roles,
}: {
  composition: Composition;
  builds: Build[];
  roles: Role[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [vaciando, setVaciando] = useState(false);

  const buildById = useMemo(() => new Map(builds.map((b) => [b.id, b])), [builds]);

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
              bloqueado={bloqueado}
              onRun={run}
              onAdelantar={
                anterior && (() => run(() => swapGroups(group, anterior)))
              }
              onAtrasar={
                siguiente && (() => run(() => swapGroups(group, siguiente)))
              }
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
  bloqueado,
  onRun,
  onAdelantar,
  onAtrasar,
}: {
  group: CompGroup;
  builds: Build[];
  roles: Role[];
  buildById: Map<string, Build>;
  bloqueado: boolean;
  onRun: (fn: () => Promise<unknown>) => void;
  /** `undefined` cuando ya es el primero o el último. */
  onAdelantar: (() => void) | undefined;
  onAtrasar: (() => void) | undefined;
}) {
  const confirmados = group.slots.filter((s) => (s.player_name ?? "").trim() !== "").length;

  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
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
        <span className="text-xs tabular-nums text-muted">
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
          const build = slot.build_id ? buildById.get(slot.build_id) : undefined;
          return (
            <li
              key={slot.id}
              className="flex items-center gap-1.5 px-2 py-1"
              // El color de la build pinta la fila: es lo que permite reconocer
              // de un vistazo quién lleva qué sin leer nada.
              style={build?.color ? { background: tinteDeFila(build.color) } : undefined}
            >
              <button
                type="button"
                title={slot.is_leader ? "Líder del grupo" : "Marcar como líder"}
                aria-label={slot.is_leader ? "Líder del grupo" : "Marcar como líder"}
                aria-pressed={slot.is_leader}
                disabled={bloqueado}
                onClick={() => onRun(() => setLeader(group.id, slot.id))}
                className={`flex size-7 shrink-0 items-center justify-center rounded ${
                  slot.is_leader ? "text-accent" : "text-border hover:text-muted"
                }`}
              >
                <Star size={14} fill={slot.is_leader ? "currentColor" : "none"} />
              </button>

              <BuildPeek build={build} />

              <select
                defaultValue={slot.build_id ?? ""}
                disabled={bloqueado}
                aria-label="Build"
                onChange={(event) =>
                  onRun(() => updateSlot(slot.id, { build_id: event.target.value || null }))
                }
                className="h-8 w-24 shrink-0 rounded border border-border bg-surface-2 px-1 text-xs sm:w-32"
              >
                <option value="">Build…</option>
                {builds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              <select
                defaultValue={slot.role_id ?? ""}
                disabled={bloqueado}
                aria-label="Rol"
                onChange={(event) =>
                  onRun(() => updateSlot(slot.id, { role_id: event.target.value || null }))
                }
                className="hidden h-8 w-24 shrink-0 rounded border border-border bg-surface-2 px-1 text-xs sm:block"
              >
                <option value="">Rol…</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>

              <input
                defaultValue={slot.player_name ?? ""}
                disabled={bloqueado}
                placeholder="Nombre"
                aria-label="Nombre del jugador"
                onBlur={(event) =>
                  onRun(() => updateSlot(slot.id, { player_name: event.target.value }))
                }
                className="h-8 min-w-0 flex-1 rounded border border-border bg-surface-2 px-2 text-xs"
              />

              {!bloqueado && (
                <button
                  type="button"
                  onClick={() => onRun(() => deleteSlot(slot.id))}
                  aria-label="Quitar persona"
                  className="flex size-7 shrink-0 items-center justify-center rounded text-muted hover:text-danger"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
            </li>
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
