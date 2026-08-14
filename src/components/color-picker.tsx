"use client";

import { useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";

import {
  colorDistance,
  hexToHsv,
  hueDistance,
  HUE_TOLERANCE,
  parseHex,
  SIMILAR_THRESHOLD,
} from "@/lib/color";

/**
 * Selector de color de build.
 *
 * El color es funcional, no decorativo: pinta la fila de esa persona en todas
 * las composiciones donde aparezca la build. Por eso el problema real no es
 * elegir un color lindo, sino no acercarse a uno que ya estés usando — dos
 * azules casi iguales vuelven la comp ilegible justo cuando hay que leerla
 * rápido.
 *
 * De ahí las tres ayudas: los puntos que muestran dónde están los colores ya
 * usados, el aviso de parecido, y la tira para reutilizar uno a propósito.
 */

export type UsedColor = { color: string; buildName: string; roleName?: string | null };

type Props = {
  value: string | null;
  onChange: (color: string | null) => void;
  /** Colores de las demás builds del usuario, para no repetirlos sin querer. */
  used: UsedColor[];
};

export function ColorPicker({ value, onChange, used }: Props) {
  const current = value ?? "#d4a94a";
  const [hexInput, setHexInput] = useState(current);

  const currentHue = useMemo(() => hexToHsv(current).h, [current]);

  /** Colores agrupados: varias builds pueden compartir exactamente el mismo. */
  const groups = useMemo(() => {
    const map = new Map<string, UsedColor[]>();
    for (const item of used) {
      const key = item.color.toLowerCase();
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].map(([color, items]) => ({
      color,
      items,
      hsv: hexToHsv(color),
    }));
  }, [used]);

  /**
   * Sobre el panel de saturación/brillo solo se marcan los colores del tono
   * actual (±15°). Los de otro tono no tienen posición real en ese cuadrado:
   * dibujarlos ahí sería inventar una ubicación.
   */
  const enPanel = groups.filter(
    (group) => hueDistance(group.hsv.h, currentHue) <= HUE_TOLERANCE,
  );

  const parecido = useMemo(() => {
    let closest: { group: (typeof groups)[number]; distance: number } | null = null;
    for (const group of groups) {
      const distance = colorDistance(current, group.color);
      if (!closest || distance < closest.distance) closest = { group, distance };
    }
    return closest && closest.distance < SIMILAR_THRESHOLD ? closest.group : null;
  }, [groups, current]);

  function commit(hex: string) {
    onChange(hex);
    setHexInput(hex);
  }

  return (
    <div className="w-64 space-y-3">
      <div className="relative">
        <HexColorPicker
          color={current}
          onChange={commit}
          style={{ width: "100%", height: 150 }}
        />

        {/* Puntos de los colores ya usados, en su ubicación exacta dentro del
            panel: x = saturación, y = 1 − brillo. */}
        {enPanel.map((group) => (
          <span
            key={group.color}
            title={group.items
              .map((i) => (i.roleName ? `${i.buildName} · ${i.roleName}` : i.buildName))
              .join("\n")}
            className="pointer-events-auto absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-white shadow"
            style={{
              left: `${group.hsv.s * 100}%`,
              // El área de tono de react-colorful ocupa la franja inferior;
              // el panel de saturación/brillo es el 78% de arriba.
              top: `${(1 - group.hsv.v) * 78}%`,
              background: group.color,
            }}
            onClick={() => commit(group.color)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-7 shrink-0 rounded-md border border-border"
          style={{ background: current }}
        />
        <input
          value={hexInput}
          onChange={(event) => {
            const raw = event.target.value;
            setHexInput(raw);
            const parsed = parseHex(raw);
            if (parsed) onChange(parsed);
          }}
          placeholder="#RRGGBB"
          spellCheck={false}
          aria-label="Código de color hexadecimal"
          className={`w-full rounded-lg border bg-surface-2 px-2 py-1.5 font-mono text-sm ${
            parseHex(hexInput) ? "border-border" : "border-danger"
          }`}
        />
      </div>

      {parecido && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs">
          Muy parecido a{" "}
          <strong>{parecido.items.map((i) => i.buildName).join(", ")}</strong>. Se pueden
          confundir en una composición.
        </p>
      )}

      {groups.length > 0 && (
        <div>
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
            Colores en uso
          </span>
          <div className="flex flex-wrap gap-1">
            {groups.map((group) => (
              <button
                key={group.color}
                type="button"
                onClick={() => commit(group.color)}
                title={group.items.map((i) => i.buildName).join("\n")}
                className="size-6 rounded-md border border-border transition-transform hover:scale-110"
                style={{ background: group.color }}
              >
                <span className="sr-only">{group.items[0].buildName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted underline underline-offset-2 hover:text-text"
        >
          Quitar el color
        </button>
      )}
    </div>
  );
}
