"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  addGroup,
  addSlot,
  deleteGroup,
  deleteSlot,
  emptyComposition,
  setLeader,
  updateComposition,
  updateGroup,
  updateSlot,
} from "@/app/actions/compositions";
import { DisarrayPanel } from "@/components/disarray-panel";
import { ItemIcon } from "@/components/item-icon";
import type { Build, Role } from "@/lib/builds-shared";
import {
  contarConfirmados,
  contarLugares,
  MAX_POR_GRUPO,
  type CompGroup,
  type Composition,
} from "@/lib/compositions-shared";

type Props = {
  composition: Composition;
  builds: Build[];
  roles: Role[];
};

export function CompositionEditor({ composition, builds, roles }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [vaciando, setVaciando] = useState(false);

  const buildById = useMemo(() => new Map(builds.map((b) => [b.id, b])), [builds]);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

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
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <input
            defaultValue={composition.name}
            disabled={bloqueado}
            onBlur={(event) =>
              event.target.value !== composition.name &&
              run(() => updateComposition(composition.id, { name: event.target.value }))
            }
            className="w-full rounded-lg border border-transparent bg-transparent px-1 text-2xl font-semibold hover:border-border focus:border-border disabled:opacity-70"
          />
          <input
            defaultValue={composition.description ?? ""}
            disabled={bloqueado}
            placeholder="Descripción: Alianza Garcia vs Alianza Guerreros, hora, punto de encuentro…"
            onBlur={(event) =>
              run(() =>
                updateComposition(composition.id, { description: event.target.value }),
              )
            }
            className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-1 text-sm text-muted hover:border-border focus:border-border disabled:opacity-70"
          />
          <p className="mt-1 px-1 text-xs text-muted">
            {formatearFecha(composition.event_at, composition.event_tz)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {bloqueado && (
            <span className="rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-xs text-accent">
              🔒 Archivada — solo lectura
            </span>
          )}
          <button
            type="button"
            onClick={() =>
              run(() =>
                updateComposition(composition.id, { is_archived: !composition.is_archived }),
              )
            }
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            {bloqueado ? "Desarchivar" : "Archivar"}
          </button>
          {!bloqueado && (
            <button
              type="button"
              onClick={() => setVaciando(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              Vaciar
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-5">
        <div className="min-w-0 flex-1 space-y-5">
          {composition.groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              builds={builds}
              roles={roles}
              buildById={buildById}
              roleById={roleById}
              bloqueado={bloqueado}
              onRun={run}
            />
          ))}

          {!bloqueado && (
            <button
              type="button"
              onClick={() => run(() => addGroup(composition.id))}
              className="w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted hover:border-accent hover:text-text"
            >
              + Agregar grupo
            </button>
          )}
        </div>

        <DisarrayPanel confirmados={confirmados} lugares={lugares} />
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

// ─── Grupo ───────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  builds,
  roles,
  buildById,
  roleById,
  bloqueado,
  onRun,
}: {
  group: CompGroup;
  builds: Build[];
  roles: Role[];
  buildById: Map<string, Build>;
  roleById: Map<string, Role>;
  bloqueado: boolean;
  onRun: (fn: () => Promise<unknown>) => void;
}) {
  const confirmados = group.slots.filter((s) => (s.player_name ?? "").trim() !== "").length;

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <input
          defaultValue={group.name ?? ""}
          disabled={bloqueado}
          placeholder="Nombre del grupo"
          onBlur={(event) => onRun(() => updateGroup(group.id, { name: event.target.value }))}
          className="w-36 rounded border border-transparent bg-transparent px-1 font-medium hover:border-border focus:border-border"
        />
        {group.guild_name !== null && (
          <input
            defaultValue={group.guild_name}
            disabled={bloqueado}
            placeholder="Gremio"
            onBlur={(event) =>
              onRun(() => updateGroup(group.id, { guild_name: event.target.value }))
            }
            className="w-32 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs"
          />
        )}
        <span className="text-xs text-muted">
          {confirmados}/{group.slots.length} confirmados
        </span>

        {!bloqueado && (
          <button
            type="button"
            onClick={() => onRun(() => deleteGroup(group.id))}
            className="ml-auto rounded px-2 py-1 text-xs text-muted hover:text-danger"
          >
            Borrar grupo
          </button>
        )}
      </header>

      <ul className="divide-y divide-border">
        {group.slots.map((slot) => {
          const build = slot.build_id ? buildById.get(slot.build_id) : undefined;
          return (
            <li
              key={slot.id}
              className="flex flex-wrap items-center gap-2 px-3 py-2"
              // El color de la build pinta la fila entera. Es el punto de todo
              // el sistema de colores: reconocer de un vistazo quién lleva qué.
              style={build?.color ? { background: `${build.color}22` } : undefined}
            >
              <button
                type="button"
                title={slot.is_leader ? "Líder del grupo" : "Marcar como líder"}
                disabled={bloqueado}
                onClick={() => onRun(() => setLeader(group.id, slot.id))}
                className={`w-6 text-center ${slot.is_leader ? "text-accent" : "text-border hover:text-muted"}`}
              >
                ★
              </button>

              <select
                defaultValue={slot.role_id ?? ""}
                disabled={bloqueado}
                onChange={(event) =>
                  onRun(() => updateSlot(slot.id, { role_id: event.target.value || null }))
                }
                className="w-32 rounded border border-border bg-surface-2 px-1.5 py-1 text-xs"
              >
                <option value="">Rol</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>

              <select
                defaultValue={slot.build_id ?? ""}
                disabled={bloqueado}
                onChange={(event) =>
                  onRun(() => updateSlot(slot.id, { build_id: event.target.value || null }))
                }
                className="w-40 rounded border border-border bg-surface-2 px-1.5 py-1 text-xs"
              >
                <option value="">Sin build</option>
                {builds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              {build && (
                <span className="flex gap-0.5">
                  {(["mainhand", "offhand", "head", "armor", "shoes"] as const).map((s) =>
                    build.items[s] ? (
                      <ItemIcon key={s} item={build.items[s]} size={22} />
                    ) : null,
                  )}
                </span>
              )}

              <input
                defaultValue={slot.player_name ?? ""}
                disabled={bloqueado}
                placeholder="Nombre del jugador"
                onBlur={(event) =>
                  onRun(() => updateSlot(slot.id, { player_name: event.target.value }))
                }
                className="min-w-0 flex-1 rounded border border-border bg-surface-2 px-2 py-1 text-xs"
              />

              {!bloqueado && (
                <button
                  type="button"
                  onClick={() => onRun(() => deleteSlot(slot.id))}
                  aria-label="Quitar persona"
                  className="rounded px-1.5 text-muted hover:text-danger"
                >
                  ×
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
          className="w-full rounded-b-xl px-4 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-text"
        >
          + Agregar persona
        </button>
      )}
    </section>
  );
}

// ─── Vaciar ──────────────────────────────────────────────────────────────────

/**
 * Doble confirmación para vaciar.
 *
 * El segundo paso pide escribir el nombre de la composición. Un segundo
 * "¿estás seguro?" idéntico al primero se clickea en piloto automático;
 * escribir el nombre, no.
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Vaciar «{nombre}»</h2>

        {paso === 1 ? (
          <>
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <strong className="text-success">Se conserva</strong> la estructura: los
                grupos, los lugares y el rol de cada uno.
              </p>
              <p>
                <strong className="text-danger">Se borra</strong> la build y el nombre de
                cada persona, y sus notas.
              </p>
              <p className="text-muted">Esto no se puede deshacer.</p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setPaso(2)}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white"
              >
                Continuar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">
              Para confirmar, escribí el nombre de la composición.
            </p>
            <input
              autoFocus
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder={nombre}
              className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={texto.trim() !== nombre}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
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
    const fecha = new Intl.DateTimeFormat("es-AR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: tz,
    }).format(new Date(iso));
    // Se muestra la zona de origen: una CTA a las 20:30 hora Argentina no es
    // la misma hora para alguien que abre esto desde España.
    return `${fecha} (${tz.split("/").pop()?.replace(/_/g, " ")})`;
  } catch {
    return new Date(iso).toLocaleString("es-AR");
  }
}
