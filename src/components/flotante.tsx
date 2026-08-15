"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Un panel que se abre al lado de algo y no lo recorta nadie.
 *
 * Un panel posicionado con `absolute` vive dentro de su contenedor, y basta con
 * que un ancestro tenga `overflow` distinto de `visible` para que lo corte. El
 * árbol de carpetas es exactamente eso: una columna angosta con su propio
 * scroll. Ahí, el selector de color de una subcarpeta se salía de la columna y
 * quedaba cortado por la mitad.
 *
 * Por eso este panel se dibuja en el `body`, fuera de todo contenedor, con
 * posición fija calculada a partir de dónde está el botón que lo abrió. Y se
 * corrige contra los bordes de la ventana: si no entra abajo se abre hacia
 * arriba, y si se pasa de un costado se corre para adentro.
 */

/** Aire que se le deja al borde de la ventana. */
const MARGEN = 8;

export function Flotante({
  ancla,
  onCerrar,
  alineacion = "izquierda",
  children,
  className = "",
}: {
  /** El elemento junto al que se abre. */
  ancla: React.RefObject<HTMLElement | null>;
  onCerrar: () => void;
  /** De qué lado del ancla se alinea, si hay lugar para los dos. */
  alineacion?: "izquierda" | "derecha";
  children: React.ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // `useLayoutEffect` y no `useEffect`: hay que medir y colocar ANTES de que el
  // navegador pinte, o el panel aparece un cuadro en la esquina y salta.
  useLayoutEffect(() => {
    const origen = ancla.current;
    const caja = panel.current;
    if (!origen || !caja) return;

    function colocar() {
      const a = origen!.getBoundingClientRect();
      const p = caja!.getBoundingClientRect();
      const ancho = window.innerWidth;
      const alto = window.innerHeight;

      let left = alineacion === "derecha" ? a.right - p.width : a.left;
      // Si se pasa por la derecha se corre para adentro, y después se revisa la
      // izquierda: con una ventana muy angosta gana el borde izquierdo.
      left = Math.min(left, ancho - p.width - MARGEN);
      left = Math.max(MARGEN, left);

      // Debajo del ancla salvo que no entre; ahí, encima.
      const abajo = a.bottom + 4;
      const top = abajo + p.height > alto - MARGEN ? Math.max(MARGEN, a.top - p.height - 4) : abajo;

      setPos({ top, left });
    }

    colocar();
    window.addEventListener("resize", colocar);
    // En captura: si el panel se abrió dentro de una columna con scroll, lo que
    // se mueve es esa columna y no la ventana, y ese evento no burbujea.
    window.addEventListener("scroll", colocar, true);
    return () => {
      window.removeEventListener("resize", colocar);
      window.removeEventListener("scroll", colocar, true);
    };
  }, [ancla, alineacion]);

  useEffect(() => {
    function fuera(evento: MouseEvent) {
      const destino = evento.target as Node;
      if (panel.current?.contains(destino)) return;
      if (ancla.current?.contains(destino)) return;
      onCerrar();
    }
    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [ancla, onCerrar]);

  return createPortal(
    <div
      ref={panel}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        // Invisible hasta estar medido, pero ocupando lugar: con `display:none`
        // no se podría medir.
        visibility: pos ? "visible" : "hidden",
      }}
      className={`z-50 rounded-xl border border-border bg-surface shadow-xl ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
