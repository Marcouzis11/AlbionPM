"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { ItemIcon } from "@/components/item-icon";
import type { Build } from "@/lib/builds-shared";
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

/** Misma disposición que el editor de builds y que el juego. */
const DISPOSICION: (EquipmentSlot | null)[][] = [
  [null, "head", "cape"],
  ["mainhand", "armor", "offhand"],
  ["mount", "shoes", "potion"],
  [null, null, "food"],
];

export function BuildPeek({ build }: { build: Build | undefined }) {
  const [abierto, setAbierto] = useState(false);

  if (!build) {
    return (
      <span
        aria-hidden
        className="size-10 shrink-0 rounded-lg border border-dashed border-border"
      />
    );
  }

  const arma = build.items.mainhand;

  return (
    <span className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={`Ver el equipo de ${build.name}`}
        title={build.name}
        className="group relative flex size-10 items-center justify-center rounded-lg border border-transparent transition-colors hover:border-accent"
      >
        {arma ? (
          <ItemIcon item={arma} size={40} />
        ) : (
          <span className="size-8 rounded-lg border border-dashed border-border" />
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
        <>
          {/* Capa para cerrar tocando afuera, sin robar el foco del teclado. */}
          <span
            className="fixed inset-0 z-30"
            onClick={() => setAbierto(false)}
            aria-hidden
          />
          <span className="absolute left-0 top-full z-40 mt-1 block w-56 rounded-xl border border-border bg-surface p-2.5 shadow-xl">
            <span className="mb-2 block truncate text-xs font-medium">{build.name}</span>

            <span className="grid grid-cols-3 gap-1.5">
              {DISPOSICION.flat().map((slot, indice) =>
                slot === null ? (
                  <span key={`v-${indice}`} aria-hidden />
                ) : (
                  <span
                    key={slot}
                    title={`${SLOT_LABELS[slot]}${build.items[slot] ? "" : " — vacío"}`}
                    className="flex aspect-square items-center justify-center rounded border border-border bg-surface-2"
                  >
                    {build.items[slot] ? (
                      <ItemIcon item={build.items[slot]} size={30} />
                    ) : (
                      <span className="text-[9px] text-muted">
                        {SLOT_LABELS[slot].slice(0, 3)}
                      </span>
                    )}
                  </span>
                ),
              )}
            </span>

            {build.notes && (
              <span className="mt-2 block border-t border-border pt-2 text-[11px] leading-snug text-muted">
                {build.notes}
              </span>
            )}
          </span>
        </>
      )}
    </span>
  );
}
