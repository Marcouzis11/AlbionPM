"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearCalcHistory,
  listCalcHistory,
  saveCalculation,
  type EntradaHistorial,
} from "@/app/actions/calc";
import { evaluar, formatear } from "@/lib/calc";

/**
 * Calculadora flotante.
 *
 * Sirve para sumar el loot de una CTA persona por persona, así que está
 * pensada alrededor de dos cosas:
 *
 * - **Entrada por teclado.** Es lo que hace viable sumar cuarenta números
 *   mientras alguien te los dicta. Sin esto, la funcionalidad no sirve.
 * - **Sobrevive a la navegación.** Podés estar mirando la composición y
 *   sumando al mismo tiempo, sin perder lo que llevabas.
 *
 * Compacta y arrastrable, porque tiene que convivir con la pantalla que estés
 * mirando, no taparla.
 */

const TECLAS = [
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["0", ".", "%", "+"],
];

export function Calculator({ onClose }: { onClose: () => void }) {
  const [expresion, setExpresion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<EntradaHistorial[]>([]);
  const [posicion, setPosicion] = useState({ x: 24, y: 96 });
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listCalcHistory().then(setHistorial);
    entrada.current?.focus();
  }, []);

  const calcular = useCallback(() => {
    const resultado = evaluar(expresion);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    const texto = formatear(resultado.valor);
    setError(null);
    // El resultado queda en pantalla listo para seguir operando encima, que es
    // como se suma loot: total parcial, más el siguiente, más el siguiente.
    setExpresion(String(resultado.valor));

    void saveCalculation(expresion, texto).then((fila) => {
      if (fila) setHistorial((previo) => [fila, ...previo].slice(0, 100));
    });
  }, [expresion]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      calcular();
    } else if (event.key === "Escape") {
      onClose();
    }
  }

  // Arrastre del panel por su encabezado.
  useEffect(() => {
    function mover(event: MouseEvent) {
      if (!arrastre.current) return;
      setPosicion({
        x: Math.max(0, event.clientX - arrastre.current.dx),
        y: Math.max(0, event.clientY - arrastre.current.dy),
      });
    }
    function soltar() {
      arrastre.current = null;
    }
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    return () => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    };
  }, []);

  function escribir(texto: string) {
    setExpresion((previo) => previo + texto);
    setError(null);
    entrada.current?.focus();
  }

  return (
    <div
      style={{ left: posicion.x, top: posicion.y }}
      className="fixed z-50 w-64 select-none rounded-xl border border-border bg-surface shadow-2xl"
    >
      <header
        onMouseDown={(event) => {
          const caja = event.currentTarget.parentElement!.getBoundingClientRect();
          arrastre.current = { dx: event.clientX - caja.left, dy: event.clientY - caja.top };
        }}
        className="flex cursor-move items-center justify-between border-b border-border px-3 py-2"
      >
        <span className="text-sm font-medium">Calculadora</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded px-1.5 text-muted hover:text-text"
        >
          ×
        </button>
      </header>

      <div className="p-3">
        <input
          ref={entrada}
          value={expresion}
          onChange={(event) => {
            setExpresion(event.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          inputMode="decimal"
          placeholder="0"
          aria-label="Expresión"
          className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-right font-mono text-lg tabular-nums"
        />

        <p className="mt-1 h-4 text-right text-[11px] text-danger">{error}</p>

        <div className="mt-1 grid grid-cols-4 gap-1">
          {TECLAS.flat().map((tecla) => (
            <button
              key={tecla}
              type="button"
              onClick={() => escribir(tecla)}
              className="rounded-md bg-surface-2 py-2 text-sm hover:bg-border"
            >
              {tecla === "*" ? "×" : tecla === "/" ? "÷" : tecla}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setExpresion("")}
            className="rounded-md bg-surface-2 py-2 text-sm text-danger hover:bg-border"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => setExpresion((p) => p.slice(0, -1))}
            className="rounded-md bg-surface-2 py-2 text-sm hover:bg-border"
          >
            ←
          </button>
          <button
            type="button"
            onClick={calcular}
            className="col-span-2 rounded-md bg-accent py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover active:translate-y-px"
          >
            =
          </button>
        </div>

        {historial.length > 0 && (
          <div className="mt-3 border-t border-border pt-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-medium text-muted">
                Historial
              </span>
              <button
                type="button"
                onClick={() => {
                  void clearCalcHistory();
                  setHistorial([]);
                }}
                className="text-[11px] text-muted hover:text-danger"
              >
                Borrar
              </button>
            </div>

            <ul className="max-h-40 overflow-y-auto">
              {historial.map((fila) => (
                <li key={fila.id}>
                  <button
                    type="button"
                    // Click en un resultado para seguir operando sobre él: es
                    // lo que se hace todo el tiempo repartiendo loot.
                    onClick={() => escribir(fila.result.replace(/\./g, ""))}
                    title="Usar este resultado"
                    className="w-full rounded px-1 py-0.5 text-right hover:bg-surface-2"
                  >
                    <span className="block truncate font-mono text-[11px] text-muted">
                      {fila.expression}
                    </span>
                    <span className="block truncate font-mono text-xs tabular-nums">
                      {fila.result}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
