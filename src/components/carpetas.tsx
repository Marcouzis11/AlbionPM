"use client";

import { Folder, FolderOpen, X } from "lucide-react";

import {
  propsDeArrastre,
  useZonaDeSoltar,
  type Arrastrado,
} from "@/components/arrastre";
import { useState } from "react";

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
 * La pantalla se parte en dos: las carpetas en una columna angosta a la
 * izquierda y el panel ocupando todo el resto. Elegir una carpeta cambia lo que
 * hay en el panel y nada más, así que las carpetas nunca se mueven de lugar y
 * mirás siempre al mismo punto de la pantalla.
 *
 * De ahí que haya una sola abierta: el panel es un lugar fijo, y dos abiertas
 * no tendrían dónde ponerse sin volver a empujar todo hacia abajo.
 */

export type FichaDeCarpeta = {
  id: string;
  nombre: string;
  /** Qué hay adentro, en una línea: «4 composiciones», «2 carpetas · 9 builds». */
  detalle: string;
  color?: string | null;
  /** Lo que se ve al abrirla. Es una función: no se arma si está cerrada. */
  panel: () => React.ReactNode;
  /** Acción secundaria —borrar—. Aparece al pasar por encima de la ficha. */
  accion?: React.ReactNode;
  /**
   * Si se puede renombrar, el nombre del encabezado del panel pasa a ser un
   * campo editable. Se guarda al salir del campo y con Enter, no con un botón
   * de guardar: es un solo dato y un botón aparte solo agregaría un paso.
   */
  onRenombrar?: (nombre: string) => void;
  /**
   * Arrastrar y soltar. Solo aplica en la computadora: en el celular el
   * arrastre nativo no se activa y queda el menú «Mover a».
   */
  arrastre?: {
    /** Lo que representa esta ficha cuando la tomás. Sin esto no se arrastra. */
    tomar?: Arrastrado;
    /** Si algo que viene arrastrado puede soltarse acá. */
    acepta?: (dato: Arrastrado) => boolean;
    alSoltar?: (dato: Arrastrado) => void;
  };
};

export function GrillaCarpetas({
  carpetas,
  inicialAbierta = null,
  vacio,
}: {
  carpetas: FichaDeCarpeta[];
  /** Cuál arranca abierta. `null` deja el panel en su estado de bienvenida. */
  inicialAbierta?: string | null;
  /** Qué decir en el panel cuando todavía no elegiste ninguna carpeta. */
  vacio: { titulo: string; detalle: string };
}) {
  const [abierta, setAbierta] = useState<string | null>(inicialAbierta);

  const visible = carpetas.find((c) => c.id === abierta);

  return (
    // Dos columnas desde `lg`: las carpetas a la izquierda, angostas, y el
    // panel ocupando todo el resto. Abajo de `lg` se apilan, porque en un
    // celular dos columnas dejarían las dos inservibles.
    // `min-h-0` en las dos columnas es lo que permite que scrolleen por su
    // cuenta: sin eso una celda de grilla crece con su contenido en vez de
    // recortarlo, y el scroll nunca aparece.
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <ul className="grid min-h-0 grid-cols-2 content-start gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-2">
        {carpetas.map((carpeta) => (
          <li key={carpeta.id}>
            <Ficha
              carpeta={carpeta}
              abierta={abierta === carpeta.id}
              onAlternar={() =>
                setAbierta((previa) => (previa === carpeta.id ? null : carpeta.id))
              }
            />
          </li>
        ))}
      </ul>

      {/* El panel se queda quieto en su columna. Elegir otra carpeta cambia lo
          que hay adentro y nada más: las carpetas no se mueven de lugar. */}
      <div className="flex min-h-0 min-w-0 flex-col">
        {visible ? (
          <CuerpoPanel
            key={visible.id}
            carpeta={visible}
            onCerrar={() => setAbierta(null)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
            <Folder size={30} className="text-muted" aria-hidden />
            <p className="font-medium">{vacio.titulo}</p>
            <p className="max-w-sm text-sm text-muted">{vacio.detalle}</p>
          </div>
        )}
      </div>
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

  const zona = useZonaDeSoltar(
    (dato) => carpeta.arrastre?.acepta?.(dato) ?? false,
    (dato) => carpeta.arrastre?.alSoltar?.(dato),
  );

  const tomar = carpeta.arrastre?.tomar;

  return (
    <div
      {...zona.props}
      {...(tomar ? propsDeArrastre(tomar) : {})}
      className={`group relative aspect-square ${
        abierta ? "-translate-y-0.5" : "hover:-translate-y-0.5"
      } ${tomar ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* La pestaña. Es lo único que separa una carpeta de un recuadro, así que
          tiene que pesar: un filo de tres píxeles no dibuja nada. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-5 w-[46%] rounded-t-lg group-hover:opacity-90"
        style={{ background: color }}
      />

      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className={`absolute inset-x-0 bottom-0 top-5 flex flex-col justify-between rounded-xl rounded-tl-none border p-3 text-left ${
          zona.encima
            ? "border-accent border-dashed bg-accent/10 ring-2 ring-accent"
            : abierta
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
        <div className="absolute right-1.5 top-6 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
          {carpeta.accion}
        </div>
      )}
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-surface"
      style={{ borderColor: `color-mix(in srgb, ${color} 45%, var(--border))` }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <span style={{ color }}>
          <FolderOpen size={16} aria-hidden />
        </span>
        {carpeta.onRenombrar ? (
          <input
            // La `key` hace que el campo tome el nombre nuevo cuando el
            // servidor confirma; sin ella conservaría el valor que tenía al
            // montarse y mostraría el viejo tras un refresco.
            key={carpeta.nombre}
            defaultValue={carpeta.nombre}
            aria-label={`Nombre de ${carpeta.nombre}`}
            maxLength={60}
            onBlur={(event) => {
              const limpio = event.target.value.trim();
              if (limpio && limpio !== carpeta.nombre) carpeta.onRenombrar?.(limpio);
              else event.target.value = carpeta.nombre;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.currentTarget.value = carpeta.nombre;
                event.currentTarget.blur();
              }
            }}
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium transition-colors hover:border-border focus:border-border"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {carpeta.nombre}
          </span>
        )}
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

      <div className="min-h-0 flex-1 overflow-y-auto p-3">{carpeta.panel()}</div>
    </div>
  );
}
