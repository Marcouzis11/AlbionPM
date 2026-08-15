"use client";

import { useEffect, useState, useTransition } from "react";

import { saveBuild } from "@/app/actions/builds";
import { ColorPicker, type UsedColor } from "@/components/color-picker";
import { Desplegable } from "@/components/desplegable";
import { ItemPicker } from "@/components/item-picker";
import type { Build, Role } from "@/lib/builds-shared";
import { EQUIPMENT_SLOTS, type BuildItem, type EquipmentSlot } from "@/lib/items";

/** Los nueve slots, con el nombre que usa la gente. */
const SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainhand: "Arma",
  offhand: "Off-hand",
  head: "Cabeza",
  armor: "Pecho",
  shoes: "Botas",
  cape: "Capa",
  food: "Comida",
  potion: "Poción",
  mount: "Montura",
};

/**
 * Disposición de los slots, imitando el panel de personaje del juego.
 *
 * Tres columnas: a la izquierda el arma y la montura, en el medio la armadura
 * de arriba abajo, y a la derecha capa, off-hand y consumibles. La idea es que
 * quien viene del juego encuentre cada pieza donde ya la busca con el ojo, sin
 * tener que leer las etiquetas.
 */
const DISPOSICION: (EquipmentSlot | null)[][] = [
  [null, "head", "cape"],
  ["mainhand", "armor", "offhand"],
  ["mount", "shoes", "potion"],
  [null, null, "food"],
];

type Props = {
  build: Build;
  roles: Role[];
  usedColors: UsedColor[];
  onClose: () => void;
  onSaved: (build: Build) => void;
};

export function BuildEditor({ build, roles, usedColors, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Build>(build);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showColor, setShowColor] = useState(false);

  useEffect(() => setDraft(build), [build]);

  /**
   * Un arma a dos manos ocupa el off-hand. Detectarlo por el identificador
   * evita tener que cargar el catálogo entero solo para saberlo.
   */
  const twoHanded = draft.items.mainhand?.id.includes("_2H_") ?? false;

  function setItem(slot: EquipmentSlot, item: BuildItem | undefined) {
    setDraft((prev) => {
      const items = { ...prev.items };
      if (item) items[slot] = item;
      else delete items[slot];

      // Si el arma pasa a ser de dos manos, el off-hand deja de tener sentido.
      if (slot === "mainhand" && item?.id.includes("_2H_")) delete items.offhand;

      return { ...prev, items };
    });
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const result = await saveBuild(draft.id, {
        name: draft.name,
        role_id: draft.role_id,
        color: draft.color,
        tags: draft.tags,
        items: draft.items,
        notes: draft.notes,
      });
      if (result.error) setError(result.error);
      else {
        onSaved(draft);
        onClose();
      }
    });
  }

  function addTag() {
    const clean = tagInput.trim().toLowerCase();
    if (!clean) return;
    setDraft((prev) => ({ ...prev, tags: [...new Set([...prev.tags, clean])] }));
    setTagInput("");
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-bg p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-semibold hover:border-border focus:border-border"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg px-2 py-1 text-muted hover:bg-surface-2"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Desplegable
            value={draft.role_id ?? ""}
            opciones={roles.map((role) => ({ value: role.id, label: role.name }))}
            onChange={(valor) => setDraft({ ...draft, role_id: valor || null })}
            etiqueta="Rol de la build"
            vacio="Sin rol"
            className="h-9 min-w-40"
          />

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColor((v) => !v)}
              className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 text-sm"
            >
              <span
                aria-hidden
                className="size-4 rounded border border-border"
                style={{ background: draft.color ?? "transparent" }}
              />
              Color
            </button>

            {showColor && (
              <div className="absolute left-0 top-full z-20 mt-1 rounded-xl border border-border bg-surface p-3 shadow-xl">
                <ColorPicker
                  value={draft.color}
                  onChange={(color) => setDraft({ ...draft, color })}
                  used={usedColors.filter((c) => c.buildName !== draft.name)}
                />
              </div>
            )}
          </div>
        </div>

        <section className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted">
            Equipo
          </h3>
          <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
            {DISPOSICION.flat().map((slot, indice) =>
              slot === null ? (
                // Hueco de la grilla: mantiene la forma del panel del juego.
                <div key={`vacio-${indice}`} aria-hidden />
              ) : (
                <ItemPicker
                  key={slot}
                  slot={slot}
                  label={SLOT_LABELS[slot]}
                  value={draft.items[slot]}
                  onChange={(item) => setItem(slot, item)}
                  disabled={slot === "offhand" && twoHanded}
                  disabledReason={
                    slot === "offhand" && twoHanded ? "Arma a dos manos" : undefined
                  }
                />
              ),
            )}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted">
            Tags
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {draft.tags.map((tag) => (
              <span
                key={tag}
                className="flex max-w-[12rem] items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-xs"
              >
                <span className="truncate">{tag}</span>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, tags: draft.tags.filter((t) => t !== tag) })
                  }
                  aria-label={`Quitar ${tag}`}
                  className="shrink-0 text-muted hover:text-danger"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="Agregar tag…"
              className="w-32 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs"
            />
          </div>
        </section>

        <section className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted">
            Notas
          </h3>
          <textarea
            value={draft.notes ?? ""}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            rows={3}
            placeholder="Instrucciones, hechizos a usar, lo que haga falta. Esto lo ve el jugador."
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
          />
        </section>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <div className="mt-auto flex justify-end gap-2 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover active:translate-y-px disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
