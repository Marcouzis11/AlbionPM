"use client";

import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

import { Flotante } from "@/components/flotante";

import { ItemIcon } from "@/components/item-icon";
import { DISPOSICION_EQUIPO, type Build } from "@/lib/builds-shared";
import type { EquipmentSlot } from "@/lib/items";

/**
 * La build de una persona dentro de una composición.
 *
 * Plegada muestra **solo el arma**. Una fila de nueve íconos por persona, con
 * veinte personas por grupo y dos grupos a la vista, son 360 íconos peleando
 * por atención: nadie lee eso. El arma alcanza para reconocer la build de un
 * vistazo, que es lo que hacés mientras armás.
 *
 * Desplegada muestra el equipo completo en la disposición del panel de
 * personaje del juego, para revisar una build puntual sin abrir otra pantalla.
 */

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainhand: "Arma",
  offhand: "Off-hand",
  head: "Cabeza",
  armor: "Pecho",
  shoes: "Botas",
  cape: "Capa",
  food: "Comida",
  potion: "Poción",
  mount: "Montura",
};

export function BuildPeek({ build }: { build: Build | undefined }) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  if (!build) {
    return (
      <span
        aria-hidden
        className="size-12 shrink-0 rounded-lg border border-dashed border-border"
      />
    );
  }

  const arma = build.items.mainhand;

  return (
    <span className="flex shrink-0 items-center">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={`Ver el equipo de ${build.name}`}
        title={build.name}
        className="group relative flex size-12 items-center justify-center rounded-lg border border-transparent transition-colors hover:border-accent"
      >
        {arma ? (
          <ItemIcon item={arma} size={64} className="size-12" />
        ) : (
          <span className="size-10 rounded-lg border border-dashed border-border" />
        )}

        {/* Marca chiquita de «hay más». Sin esto, nada indica que la fila
            esconde ocho piezas más. */}
        <ChevronDown
          size={11}
          aria-hidden
          className={`absolute -bottom-0.5 -right-0.5 rounded-sm bg-surface text-muted transition-transform group-hover:text-accent motion-reduce:transition-none ${
            abierto ? "rotate-180" : ""
          }`}
        />
      </button>

      {abierto && (
        // Se dibuja fuera de la fila con `Flotante`, y no acá adentro con una
        // capa a pantalla completa para cerrarlo. Esa capa tapaba la página y
        // no dejaba scrollear hasta cerrar el panel. Además, la fila tiene un
        // color de texto propio calculado contra el color de la build, y el
        // panel lo heredaba: el nombre salía en negro sobre el gris del panel.
        <Flotante
          ancla={boton}
          onCerrar={() => setAbierto(false)}
          className="w-72 p-3 text-text"
        >
          <p className="mb-2 truncate text-xs font-medium">{build.name}</p>

          <div className="grid grid-cols-3 gap-0.5">
            {DISPOSICION_EQUIPO.flat().map((slot, indice) =>
              slot === null ? (
                <span key={`v-${indice}`} aria-hidden />
              ) : (
                <span
                  key={slot}
                  title={`${SLOT_LABELS[slot]}${build.items[slot] ? "" : " (vacío)"}`}
                  className={`flex aspect-square items-center justify-center rounded-lg ${
                    build.items[slot] ? "" : "border border-dashed border-border"
                  }`}
                >
                  {build.items[slot] ? (
                    <ItemIcon item={build.items[slot]} size={96} className="h-auto w-full" />
                  ) : (
                    <span className="text-[9px] font-semibold text-muted">
                      {SLOT_LABELS[slot].slice(0, 3)}
                    </span>
                  )}
                </span>
              ),
            )}
          </div>

          {build.notes && (
            <p className="mt-2 border-t border-border pt-2 text-[11px] leading-snug text-muted">
              {build.notes}
            </p>
          )}
        </Flotante>
      )}
    </span>
  );
}
