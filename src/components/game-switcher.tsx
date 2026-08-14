"use client";

import { Check, ChevronDown, Swords } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Game } from "@/lib/data/contents";

/**
 * Selector de juego.
 *
 * Cerrado muestra solo el emblema del juego: una vez elegido, repetir el
 * nombre en la barra es ocupar lugar para decir algo que ya sabés. Abierto sí
 * muestra nombre e ícono, que es cuando hace falta distinguir entre opciones.
 */

/** Emblema por juego. Cuando haya más, cada uno tendrá el suyo. */
function EmblemaJuego({ slug, size = 18 }: { slug: string; size?: number }) {
  if (slug === "albion-online") return <Swords size={size} aria-hidden />;
  return <Swords size={size} aria-hidden />;
}

export function GameSwitcher({ game, games }: { game: Game; games: Game[] }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    function fuera(event: MouseEvent) {
      if (!caja.current?.contains(event.target as Node)) setAbierto(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setAbierto(false);
    }

    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const solo = games.length <= 1;

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => !solo && setAbierto((v) => !v)}
        aria-haspopup={solo ? undefined : "listbox"}
        aria-expanded={solo ? undefined : abierto}
        aria-label={solo ? game.name : `Juego: ${game.name}. Cambiar`}
        title={game.name}
        // 44 px de lado: es el mínimo cómodo para tocar en un celular.
        className={`flex size-11 items-center justify-center rounded-lg border border-border bg-surface-2 text-accent transition-colors ${
          solo ? "cursor-default" : "hover:border-accent"
        }`}
      >
        <EmblemaJuego slug={game.slug} />
        {!solo && (
          <ChevronDown size={12} className="ml-0.5 text-muted" aria-hidden />
        )}
      </button>

      {abierto && !solo && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 min-w-52 rounded-xl border border-border bg-surface p-1 shadow-xl"
        >
          {games.map((option) => {
            const actual = option.id === game.id;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={actual}
                  onClick={() => {
                    if (!actual) window.location.href = `/app/${option.slug}`;
                    setAbierto(false);
                  }}
                  className="flex h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-surface-2"
                >
                  <span className="text-accent">
                    <EmblemaJuego slug={option.slug} size={16} />
                  </span>
                  <span className="flex-1 truncate">{option.name}</span>
                  {actual && <Check size={14} className="text-accent" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
