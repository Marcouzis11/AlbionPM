"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Un desplegable con el diseño de la aplicación.
 *
 * El `<select>` nativo no se puede pintar: la lista que abre la dibuja el
 * sistema operativo, no la página, así que en el medio de una fila de color
 * aparecía un menú blanco de Windows o gris de GNOME. Esto es un botón más una
 * lista propia, que sí se puede pintar.
 *
 * Lo que el nativo daba gratis y hay que reponer a mano:
 *
 * - Se abre con Enter, con la barra o con las flechas.
 * - Las flechas recorren, Enter elige, Escape cierra y devuelve el foco.
 * - `role="listbox"` y `aria-selected`, para que un lector de pantalla lo
 *   anuncie como lo que es.
 * - Al abrirse queda marcada la opción actual, no la primera.
 */

export type Opcion = { value: string; label: string };

export function Desplegable({
  value,
  opciones,
  onChange,
  etiqueta,
  vacio = "Sin elegir",
  disabled = false,
  className = "",
}: {
  value: string;
  opciones: Opcion[];
  onChange: (value: string) => void;
  /** Para quien no ve el control. */
  etiqueta: string;
  /** Texto de la opción que no elige nada. */
  vacio?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [marcada, setMarcada] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const todas: Opcion[] = [{ value: "", label: vacio }, ...opciones];
  const actual = todas.find((o) => o.value === value) ?? todas[0];

  /** Abrir deja marcada la opción actual, no la primera. */
  function abrir() {
    setMarcada(Math.max(0, todas.findIndex((o) => o.value === value)));
    setAbierto(true);
  }

  useEffect(() => {
    if (!abierto) return;
    // Se cierra al tocar afuera. `mousedown` y no `click` para que cerrar no
    // dispare de paso lo que haya debajo.
    function afuera(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", afuera);
    return () => document.removeEventListener("mousedown", afuera);
  }, [abierto]);

  useEffect(() => {
    if (abierto) lista.current?.focus();
  }, [abierto]);

  function elegir(opcion: Opcion) {
    setAbierto(false);
    boton.current?.focus();
    if (opcion.value !== value) onChange(opcion.value);
  }

  function teclas(evento: React.KeyboardEvent) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      setAbierto(false);
      boton.current?.focus();
      return;
    }
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      const paso = evento.key === "ArrowDown" ? 1 : -1;
      setMarcada((previa) => (previa + paso + todas.length) % todas.length);
      return;
    }
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      elegir(todas[marcada]);
    }
  }

  return (
    <div ref={contenedor} className={`relative ${className}`}>
      <button
        ref={boton}
        type="button"
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={(evento) => {
          if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
            evento.preventDefault();
            abrir();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={etiqueta}
        className="flex h-full w-full items-center gap-1 rounded border border-border bg-surface px-1.5 text-left text-xs text-text disabled:opacity-60"
      >
        <span className={`min-w-0 flex-1 truncate ${value ? "" : "text-muted"}`}>
          {actual.label}
        </span>
        <ChevronDown size={12} aria-hidden className="shrink-0 text-muted" />
      </button>

      {abierto && (
        <div
          ref={lista}
          role="listbox"
          aria-label={etiqueta}
          tabIndex={-1}
          onKeyDown={teclas}
          className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-40 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-xl outline-none"
        >
          {todas.map((opcion, indice) => (
            <div
              key={opcion.value || "__vacio__"}
              role="option"
              aria-selected={opcion.value === value}
              onClick={() => elegir(opcion)}
              onMouseEnter={() => setMarcada(indice)}
              className={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded px-1.5 text-xs ${
                indice === marcada ? "bg-surface-2" : ""
              } ${opcion.value ? "" : "text-muted"}`}
            >
              <Check
                size={12}
                aria-hidden
                className={`shrink-0 ${opcion.value === value ? "" : "invisible"}`}
              />
              <span className="min-w-0 flex-1 truncate">{opcion.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
