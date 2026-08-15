"use client";

import { FolderInput } from "lucide-react";
import { useRef, useState } from "react";

import { Flotante } from "@/components/flotante";

/**
 * Mover una cosa a otra carpeta.
 *
 * Es un menú y no un arrastre. Arrastrar se ve mejor en una demo, pero esto se
 * usa desde el celular tanto como desde la computadora, y arrastrar con el dedo
 * dentro de una lista que además scrollea es una pelea perdida. Un menú se toca
 * igual de bien en las dos, se recorre con el teclado y dice a dónde vas antes
 * de que la cosa se mueva.
 *
 * El destino puede venir con su ruta («Tanques / ZvZ») porque en una biblioteca
 * con carpetas anidadas hay tres carpetas llamadas «Gankeo» y el nombre suelto
 * no alcanza para elegir bien.
 */

export type Destino = {
  id: string;
  nombre: string;
  /** La ruta hasta el padre, si la carpeta está anidada. */
  ruta?: string;
};

export function MoverA({
  etiqueta,
  destinos,
  onMover,
}: {
  /** Qué se mueve, para quien no ve el ícono. */
  etiqueta: string;
  destinos: Destino[];
  onMover: (destinoId: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  if (destinos.length === 0) return null;

  return (
    <span className="flex shrink-0 items-center">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={etiqueta}
        title={etiqueta}
        className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <FolderInput size={15} aria-hidden />
      </button>

      {abierto && (
        <Flotante
          ancla={boton}
          onCerrar={() => setAbierto(false)}
          alineacion="derecha"
          className="max-h-64 w-60 overflow-y-auto p-1"
        >
          <p className="px-2 py-1.5 text-[11px] font-medium text-muted">Mover a</p>
          {destinos.map((destino) => (
            <button
              key={destino.id}
              type="button"
              onClick={() => {
                setAbierto(false);
                onMover(destino.id);
              }}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{destino.nombre}</span>
                {destino.ruta && (
                  <span className="block truncate text-[11px] text-muted">
                    {destino.ruta}
                  </span>
                )}
              </span>
            </button>
          ))}
        </Flotante>
      )}
    </span>
  );
}
