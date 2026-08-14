"use client";

import { Folder, FolderOpen, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Carpetas: la ficha, la grilla y la apertura en el lugar.
 *
 * Un contenido y una carpeta de builds son la misma idea —algo que guarda
 * cosas adentro— así que son el mismo objeto visual y se comportan igual. Vive
 * acá una sola vez para que no se separen con el tiempo.
 *
 * La ficha tiene forma de carpeta de verdad: pestaña arriba a la izquierda y
 * cuerpo debajo. Es lo que hace que se entienda sin leer nada que eso se abre
 * y tiene cosas adentro.
 *
 * Abrir NO te saca de la pantalla y TAMPOCO mueve las carpetas. El panel vive
 * fuera de la grilla, siempre debajo: la fila de fichas se queda quieta y lo
 * que hay adentro aparece siempre en el mismo lugar. Antes el panel era una
 * celda más y se metía en el medio, así que abrir la primera carpeta empujaba
 * a las otras cuatro fuera de la vista, que es justo lo que uno no quiere
 * mientras compara.
 *
 * Por eso también hay una sola abierta por nivel: con el panel en un lugar
 * fijo, dos abiertas apilarían dos paneles y volvería el mismo problema.
 */

export type FichaDeCarpeta = {
  id: string;
  nombre: string;
  /** Qué hay adentro, en una línea: «4 composiciones», «2 carpetas · 9 builds». */
  detalle: string;
  color?: string | null;
  /** Lo que se ve al abrirla. Es una función: no se arma si está cerrada. */
  panel: () => React.ReactNode;
  /** Acción secundaria —borrar, renombrar—. Aparece al pasar por encima. */
  accion?: React.ReactNode;
};

/** Lo que tarda el panel en abrirse y cerrarse. El CSS usa el mismo número. */
const DURACION = 300;

export function GrillaCarpetas({
  carpetas,
  inicialAbierta = null,
  anidada = false,
}: {
  carpetas: FichaDeCarpeta[];
  /** Cuál arranca abierta. Sin esto, una pantalla de carpetas cerradas no
      muestra nada de lo que la persona vino a buscar. */
  inicialAbierta?: string | null;
  /** Una grilla dentro de un panel: fichas más chicas para marcar el nivel. */
  anidada?: boolean;
}) {
  // La selección vive acá adentro y no arriba: en Builds hay grillas dentro de
  // grillas, y cada nivel tiene que poder tener la suya abierta sin cerrar la
  // del nivel de arriba.
  const [abierta, setAbierta] = useState<string | null>(inicialAbierta);

  // La que se está cerrando sigue montada hasta terminar de plegarse. Sin esto
  // desaparecería de golpe y solo se vería la animación de ida.
  const [mostrando, setMostrando] = useState<string | null>(inicialAbierta);

  function alternar(id: string) {
    if (abierta === id) {
      // Cerrar solo suelta la selección: el panel sigue montado hasta que el
      // efecto de abajo lo desmonta, ya terminada la animación.
      setAbierta(null);
      return;
    }
    setAbierta(id);
    setMostrando(id);
  }

  useEffect(() => {
    if (abierta !== null) return;
    // Un temporizador y no `transitionend`: con `prefers-reduced-motion` no hay
    // transición, el evento nunca llega y el panel quedaría montado para
    // siempre.
    const timer = setTimeout(() => setMostrando(null), DURACION);
    return () => clearTimeout(timer);
  }, [abierta]);

  const visible = carpetas.find((c) => c.id === mostrando);

  return (
    <div>
      {/* La grilla no se toca nunca. El panel vive FUERA de ella, así abrir una
          carpeta no parte la fila ni empuja a las demás hacia abajo: las fichas
          se quedan donde estaban y lo que cambia es siempre el mismo lugar,
          justo debajo. */}
      <ul
        className={
          anidada
            ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
            : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        }
      >
        {carpetas.map((carpeta) => (
          <li key={carpeta.id}>
            <Ficha
              carpeta={carpeta}
              abierta={abierta === carpeta.id}
              onAlternar={() => alternar(carpeta.id)}
            />
          </li>
        ))}
      </ul>

      {visible && (
        <Panel abierto={abierta !== null}>
          {/* La `key` hace que al pasar de una carpeta a otra el contenido
              vuelva a entrar escalonado, en vez de cambiar de golpe y dejarte
              dudando de si se actualizó. */}
          <CuerpoPanel
            key={visible.id}
            carpeta={visible}
            onCerrar={() => setAbierta(null)}
          />
        </Panel>
      )}
    </div>
  );
}

/**
 * La ficha con forma de carpeta.
 *
 * La pestaña lleva el color de la carpeta. En una grilla de nueve fichas
 * iguales, el color es lo que las distingue de un vistazo; el nombre hay que
 * leerlo.
 */
function Ficha({
  carpeta,
  abierta,
  onAlternar,
}: {
  carpeta: FichaDeCarpeta;
  abierta: boolean;
  onAlternar: () => void;
}) {
  const color = carpeta.color ?? "var(--muted)";

  return (
    <div
      className={`group relative aspect-square transition-transform duration-200 motion-reduce:transition-none ${
        abierta ? "-translate-y-0.5" : "hover:-translate-y-0.5"
      }`}
    >
      {/* La pestaña. Es lo único que separa una carpeta de un recuadro, así que
          tiene que pesar: un filo de tres píxeles no dibuja nada. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-5 w-[46%] rounded-t-lg transition-opacity group-hover:opacity-90"
        style={{ background: color }}
      />

      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className={`absolute inset-x-0 bottom-0 top-5 flex flex-col justify-between rounded-xl rounded-tl-none border p-3 text-left transition-colors ${
          abierta
            ? "border-accent bg-surface-2"
            : "border-border bg-surface hover:border-accent"
        }`}
      >
        <span style={{ color }}>
          {abierta ? <FolderOpen size={26} aria-hidden /> : <Folder size={26} aria-hidden />}
        </span>

        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{carpeta.nombre}</span>
          <span className="block truncate text-xs text-muted">{carpeta.detalle}</span>
        </span>
      </button>

      {carpeta.accion && (
        <div className="absolute right-1.5 top-6 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {carpeta.accion}
        </div>
      )}
    </div>
  );
}

/**
 * El panel desplegado.
 *
 * La animación va de `grid-rows: 0fr` a `1fr`, que es la forma de animar «alto
 * automático» sin inventar alturas a mano: lo de abajo se corre acompañando la
 * apertura en vez de saltar.
 */
function Panel({ abierto, children }: { abierto: boolean; children: React.ReactNode }) {
  // Monta cerrado y abre en el cuadro siguiente. Si naciera abierto no habría
  // desde dónde animar y el panel aparecería de golpe.
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => setListo(true));
    return () => cancelAnimationFrame(cuadro);
  }, []);

  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
        abierto && listo ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * El encabezado dice de qué carpeta es lo que estás viendo.
 *
 * El panel ocupa el ancho completo y arranca debajo de una fila con varias
 * fichas, así que sin nombre propio no se sabría cuál de ellas abriste.
 */
function CuerpoPanel({
  carpeta,
  onCerrar,
}: {
  carpeta: FichaDeCarpeta;
  onCerrar: () => void;
}) {
  const color = carpeta.color ?? "var(--muted)";

  return (
    <div
      className="mt-3 rounded-xl border bg-surface"
      style={{ borderColor: `color-mix(in srgb, ${color} 45%, var(--border))` }}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span style={{ color }}>
          <FolderOpen size={16} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {carpeta.nombre}
        </span>
        <span className="hidden text-xs text-muted sm:block">{carpeta.detalle}</span>
        <button
          type="button"
          onClick={onCerrar}
          aria-label={`Cerrar ${carpeta.nombre}`}
          className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="p-3">{carpeta.panel()}</div>
    </div>
  );
}
