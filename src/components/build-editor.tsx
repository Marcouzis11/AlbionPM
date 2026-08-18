"use client";

import { useEffect, useRef, useState } from "react";

import { ColorPicker, type UsedColor } from "@/components/color-picker";
import { Desplegable } from "@/components/desplegable";
import { Flotante } from "@/components/flotante";
import { ItemPicker } from "@/components/item-picker";
import {
  DISPOSICION_EQUIPO,
  type Build,
  type Role,
} from "@/lib/builds-shared";
import {
  EQUIPMENT_SLOTS,
  SLOT_LABELS,
  type BuildItem,
  type EquipmentSlot,
} from "@/lib/items";

/**
 * ¿Se tocó algo desde que se abrió?
 *
 * Se compara campo por campo y no con `JSON.stringify`: el orden de las claves
 * de `items` cambia al sacar y volver a poner una pieza, y eso marcaría como
 * editada una build que quedó igual.
 */
function hayCambios(borrador: Build, original: Build): boolean {
  if (borrador.name !== original.name) return true;
  if (borrador.role_id !== original.role_id) return true;
  if (borrador.color !== original.color) return true;
  if ((borrador.notes ?? "") !== (original.notes ?? "")) return true;
  if (borrador.tags.join("\u0000") !== original.tags.join("\u0000")) return true;

  return EQUIPMENT_SLOTS.some((slot) => {
    const a = borrador.items[slot];
    const b = original.items[slot];
    if (!a || !b) return Boolean(a) !== Boolean(b);
    return (
      a.id !== b.id || (a.ench ?? 0) !== (b.ench ?? 0) || (a.quality ?? 1) !== (b.quality ?? 1)
    );
  });
}

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
  const [showColor, setShowColor] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const botonColor = useRef<HTMLButtonElement>(null);

  /**
   * Cerrar sin querer no puede costar el trabajo hecho.
   *
   * El editor se abre sobre un fondo oscuro que ocupa toda la pantalla, y ese
   * fondo cerraba de una. Un click de más al costado del panel —o el reflejo de
   * apretar Escape— y se perdían diez minutos de armar una build sin que nada
   * lo preguntara. Ahora se pregunta, pero solo cuando hay algo que perder: si
   * no se tocó nada, cerrar sigue siendo instantáneo.
   *
   * El tag a medio escribir cuenta como cambio. Se agrega al perder el foco,
   * así que al momento de este click todavía no está en el borrador.
   */
  const sucio = hayCambios(draft, build) || tagInput.trim() !== "";

  function intentarCerrar() {
    if (sucio) setConfirmarSalida(true);
    else onClose();
  }

  useEffect(() => {
    function tecla(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      // Con la paleta abierta, Escape es de ella: la cierra `Flotante` y el
      // editor se queda donde está.
      if (showColor) return;
      if (confirmarSalida) {
        setConfirmarSalida(false);
        return;
      }
      if (sucio) setConfirmarSalida(true);
      else onClose();
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [showColor, confirmarSalida, sucio, onClose]);

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

  /**
   * Guarda y cierra, sin esperar al servidor.
   *
   * Antes el editor se quedaba abierto con «Guardando…» hasta que volvía la
   * respuesta, y solo cerraba si salía bien. Cualquier tropiezo —una respuesta
   * que no llega, una promesa rechazada— te dejaba encerrado en un cartel del
   * que no se sale, con el cambio ya escrito en la base. De ahí que recargar
   * «arreglara» el problema: el guardado había funcionado, lo que se colgaba
   * era la pantalla.
   *
   * Lo único que se comprueba acá es lo que puede saberse sin preguntar. El
   * resto de los errores los muestra la biblioteca, que es la que sigue en pie
   * cuando esto ya cerró.
   */
  function guardar(): boolean {
    if (!draft.name.trim()) {
      setError("La build necesita un nombre.");
      return false;
    }
    setError(null);
    onSaved(draft);
    onClose();
    return true;
  }

  function addTag() {
    const clean = tagInput.trim().toLowerCase();
    if (!clean) return;
    setDraft((prev) => ({ ...prev, tags: [...new Set([...prev.tags, clean])] }));
    setTagInput("");
  }

  return (
    <>
      <div
        className="fixed inset-0 z-30 flex justify-end bg-black/50"
        onClick={intentarCerrar}
      >
        <div
          className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-bg px-6 pb-6 pt-9"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-end justify-between gap-3">
            {/* Un campo con cara de campo. Antes esto era el nombre dibujado como
                título: sin borde, sin fondo y sin etiqueta, y el borde aparecía
                recién al pasar el mouse. Se podía editar, pero no había manera de
                darse cuenta de que se podía. */}
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-medium text-muted">
                Nombre de la build
              </span>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Ponele un nombre"
                maxLength={80}
                className="h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-lg font-semibold"
              />
            </label>
            <button
              type="button"
              onClick={intentarCerrar}
              aria-label="Cerrar"
              className="mb-0.5 shrink-0 rounded-lg px-2 py-1 text-xl text-muted hover:bg-surface-2"
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

            {/* La paleta va en un `Flotante` y no en un `absolute` propio: así se
                cierra sola al clickear afuera o con Escape, igual que las demás
                de la aplicación, y no la recorta el scroll del editor. */}
            <div>
              <button
                ref={botonColor}
                type="button"
                onClick={() => setShowColor((v) => !v)}
                aria-expanded={showColor}
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
                <Flotante
                  ancla={botonColor}
                  onCerrar={() => setShowColor(false)}
                  className="p-3"
                >
                  <ColorPicker
                    value={draft.color}
                    onChange={(color) => setDraft({ ...draft, color })}
                    used={usedColors.filter((c) => c.buildName !== draft.name)}
                  />
                </Flotante>
              )}
            </div>
          </div>

          <section className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-muted">
              Equipo
            </h3>
            <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
              {DISPOSICION_EQUIPO.flat().map((slot, indice) =>
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
              onClick={intentarCerrar}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover active:translate-y-px"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>

      {confirmarSalida && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">Tenés cambios sin guardar</h2>
            <p className="mt-2 text-sm text-muted">
              Si cerrás ahora, la build queda como estaba antes de abrirla.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmarSalida(false)}
                className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-surface-2"
              >
                Seguir editando
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmarSalida(false);
                  onClose();
                }}
                className="h-10 rounded-lg px-4 text-sm text-muted underline underline-offset-2 hover:text-danger"
              >
                Descartar
              </button>
              <button
                type="button"
                // Si le falta el nombre, `guardar` no cierra. El aviso se saca
                // igual, porque el error se ve en el editor y este cartel lo tapa.
                onClick={() => {
                  guardar();
                  setConfirmarSalida(false);
                }}
                className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover active:translate-y-px"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
