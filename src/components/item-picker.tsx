"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ItemIcon } from "@/components/item-icon";
import type { BuildItem, EquipmentSlot, Enchantment, Quality } from "@/lib/items";

/**
 * Selector de item para un slot de la build.
 *
 * El catálogo se descarga por slot desde `/items/{slot}.json`, servido como
 * archivo estático por el CDN. Mandar el catálogo completo serían 217 KB para
 * elegir un arma; así el más pesado son ~93 KB y solo el del slot que se abre.
 */

type SlotItem = { id: string; en: string; es: string; tier: number; twoHanded?: true };

/** Una vez descargado, el catálogo de un slot no se vuelve a pedir. */
const cache = new Map<EquipmentSlot, Promise<SlotItem[]>>();

function loadSlot(slot: EquipmentSlot): Promise<SlotItem[]> {
  let pending = cache.get(slot);
  if (!pending) {
    pending = fetch(`/items/${slot}.json`).then((r) => r.json());
    cache.set(slot, pending);
  }
  return pending;
}

/**
 * Quita acentos y pasa a minúsculas.
 *
 * Nadie escribe "Espada ancha del anciano" con tilde cuando está apurado, y
 * mucho menos desde el celular. Sin esto, buscar "anciano" no encontraría
 * "anciáno" ni al revés.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type Props = {
  slot: EquipmentSlot;
  value: BuildItem | undefined;
  onChange: (item: BuildItem | undefined) => void;
  label: string;
  /** El off-hand se bloquea cuando el arma principal ocupa las dos manos. */
  disabled?: boolean;
  disabledReason?: string;
};

export function ItemPicker({
  slot,
  value,
  onChange,
  label,
  disabled,
  disabledReason,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SlotItem[]>([]);
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) void loadSlot(slot).then(setItems);
  }, [open, slot]);

  // Cerrar al hacer click afuera o con Escape.
  useEffect(() => {
    if (!open) return;

    function onPointer(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const resultados = useMemo(() => {
    const q = normalizar(query.trim());
    return items
      .filter((item) => (tier === null || item.tier === tier))
      .filter((item) => !q || normalizar(item.es).includes(q) || normalizar(item.en).includes(q))
      .slice(0, 60);
  }, [items, query, tier]);

  const seleccionado = items.find((item) => item.id === value?.id);

  return (
    <div className="relative">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
        {label}
      </span>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={disabled ? disabledReason : undefined}
        className="flex h-[76px] w-full items-center gap-2 rounded-lg border border-border bg-surface-2 p-2 pb-6 text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {value ? (
          <>
            <ItemIcon item={value} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs">
                {seleccionado?.es ?? value.id}
              </span>
              <span className="block text-[11px] text-muted">
                {value.quality && value.quality > 1 ? CALIDADES[value.quality] : "\u00a0"}
              </span>
            </span>
          </>
        ) : (
          <span className="text-xs text-muted">
            {disabled ? disabledReason : "Vacío"}
          </span>
        )}
      </button>

      {value && !disabled && (
        <>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label={`Quitar ${label}`}
            className="absolute right-1 top-5 rounded px-1 text-xs text-muted hover:text-danger"
          >
            ×
          </button>

          {/* Encantamiento sin abrir el selector: es lo que más se toquetea al
              armar una build, y entrar al panel cada vez sería una fricción
              absurda para subir un punto. El ícono cambia al instante. */}
          <div className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-md border border-border bg-surface px-0.5">
            <button
              type="button"
              aria-label="Bajar encantamiento"
              disabled={(value.ench ?? 0) <= 0}
              onClick={() =>
                onChange({ ...value, ench: Math.max(0, (value.ench ?? 0) - 1) as Enchantment })
              }
              className="px-1 text-xs leading-none text-muted hover:text-text disabled:opacity-30"
            >
              −
            </button>
            <span className="min-w-[1.6rem] text-center font-mono text-[11px] tabular-nums">
              .{value.ench ?? 0}
            </span>
            <button
              type="button"
              aria-label="Subir encantamiento"
              disabled={(value.ench ?? 0) >= 4}
              onClick={() =>
                onChange({ ...value, ench: Math.min(4, (value.ench ?? 0) + 1) as Enchantment })
              }
              className="px-1 text-xs leading-none text-muted hover:text-text disabled:opacity-30"
            >
              +
            </button>
          </div>
        </>
      )}

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-20 mt-1 w-80 rounded-xl border border-border bg-surface p-3 shadow-xl"
        >
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar en español o inglés…"
            className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm"
          />

          <div className="mt-2 flex flex-wrap gap-1">
            <FiltroTier tier={null} actual={tier} onSelect={setTier} />
            {[4, 5, 6, 7, 8].map((t) => (
              <FiltroTier key={t} tier={t} actual={tier} onSelect={setTier} />
            ))}
          </div>

          <ul className="mt-2 max-h-64 overflow-y-auto">
            {resultados.length === 0 && (
              <li className="px-1 py-3 text-center text-xs text-muted">
                {items.length === 0 ? "Cargando…" : "Nada con ese nombre."}
              </li>
            )}
            {resultados.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ id: item.id, ench: value?.ench, quality: value?.quality });
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface-2"
                >
                  <ItemIcon item={item.id} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{item.es}</span>
                    <span className="block truncate text-[11px] text-muted">{item.en}</span>
                  </span>
                  <span className="text-[11px] text-muted">T{item.tier}</span>
                </button>
              </li>
            ))}
          </ul>

          {value && (
            <div className="mt-2 border-t border-border pt-2">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
                Encantamiento
              </span>
              <div className="flex gap-1">
                {([0, 1, 2, 3, 4] as Enchantment[]).map((ench) => (
                  <button
                    key={ench}
                    type="button"
                    onClick={() => onChange({ ...value, ench })}
                    className={`flex-1 rounded-md px-2 py-1 text-xs transition-colors ${
                      (value.ench ?? 0) === ench
                        ? "bg-accent text-accent-fg"
                        : "bg-surface-2 text-muted hover:text-text"
                    }`}
                  >
                    .{ench}
                  </button>
                ))}
              </div>

              <span className="mb-1 mt-2 block text-[11px] uppercase tracking-wider text-muted">
                Calidad
              </span>
              <div className="flex gap-1">
                {([1, 2, 3, 4, 5] as Quality[]).map((quality) => (
                  <button
                    key={quality}
                    type="button"
                    onClick={() => onChange({ ...value, quality })}
                    title={CALIDADES[quality]}
                    className={`flex-1 rounded-md px-2 py-1 text-xs transition-colors ${
                      (value.quality ?? 1) === quality
                        ? "bg-accent text-accent-fg"
                        : "bg-surface-2 text-muted hover:text-text"
                    }`}
                  >
                    {quality}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CALIDADES: Record<number, string> = {
  1: "Normal",
  2: "Bueno",
  3: "Excepcional",
  4: "Excelente",
  5: "Obra maestra",
};

function FiltroTier({
  tier,
  actual,
  onSelect,
}: {
  tier: number | null;
  actual: number | null;
  onSelect: (tier: number | null) => void;
}) {
  const active = actual === tier;
  return (
    <button
      type="button"
      onClick={() => onSelect(tier)}
      className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
        active ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-text"
      }`}
    >
      {tier === null ? "Todos" : `T${tier}`}
    </button>
  );
}
