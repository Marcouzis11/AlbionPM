"use client";

import { useState } from "react";

import { MAXIMO, nivelDisarray, perdidaPorcentual, UMBRAL } from "@/data/disarray";

/**
 * Panel de Disarray estimado.
 *
 * Se llama "estimado" y no "Disarray" a secas por tres motivos que están
 * explicados en `src/data/disarray.ts`: depende del cluster y no de la comp,
 * el efecto es relativo al rival, y la tabla real no es pública. Prometer
 * precisión acá sería mentir.
 */
export function DisarrayPanel({
  confirmados,
  lugares,
}: {
  confirmados: number;
  lugares: number;
}) {
  const [extra, setExtra] = useState(0);
  const [enemigos, setEnemigos] = useState(0);

  const total = confirmados + extra;
  const propio = nivelDisarray(total);
  const rival = nivelDisarray(enemigos);
  const perdida = enemigos > 0 ? perdidaPorcentual(propio, rival) : null;

  return (
    <aside className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div>
        <h3 className="text-sm font-medium">Disarray estimado</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
          Depende de cuánta gente de tu alianza haya en la zona, no solo de esta
          composición. Tomalo como referencia.
        </p>
      </div>

      <div>
        <p className="text-3xl font-semibold tabular-nums">
          {propio.toFixed(1)}
          <span className="text-lg text-muted">%</span>
        </p>
        <p className="text-xs text-muted">
          {total <= UMBRAL
            ? `Sin Disarray: arranca a partir de ${UMBRAL} jugadores.`
            : propio >= MAXIMO
              ? "En el techo de la curva."
              : `Con ${total} jugadores.`}
        </p>
      </div>

      <div className="rounded-lg bg-surface-2 p-2.5">
        <p className="text-sm">
          <strong className="tabular-nums">{confirmados}</strong> confirmados
          <span className="text-muted"> / {lugares} lugares</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted">
          Solo cuentan los lugares con un nombre escrito.
        </p>
      </div>

      <label className="block">
        <span className="text-xs text-muted">Aliados extra en la zona</span>
        <input
          type="number"
          min={0}
          value={extra}
          onChange={(event) => setExtra(Math.max(0, Number(event.target.value) || 0))}
          className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm tabular-nums"
        />
      </label>

      <div className="border-t border-border pt-3">
        <label className="block">
          <span className="text-xs text-muted">Tamaño del enemigo</span>
          <input
            type="number"
            min={0}
            value={enemigos}
            onChange={(event) => setEnemigos(Math.max(0, Number(event.target.value) || 0))}
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm tabular-nums"
          />
        </label>

        {perdida !== null && (
          <p className="mt-2 text-xs leading-relaxed">
            {perdida <= 0 ? (
              <span className="text-success">
                Sin penalización: el enemigo tiene Disarray igual o mayor.
              </span>
            ) : (
              <>
                Perdés cerca de{" "}
                <strong className="tabular-nums text-danger">{perdida}%</strong> de daño
                contra ellos.
              </>
            )}
          </p>
        )}
      </div>
    </aside>
  );
}
