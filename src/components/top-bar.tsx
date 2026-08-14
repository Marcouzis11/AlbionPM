"use client";

import { Calculator as CalculatorIcon, History, Shirt, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/app/actions/auth";
import { Calculator } from "@/components/calculator";
import { GameSwitcher } from "@/components/game-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Game } from "@/lib/data/contents";
import type { Theme } from "@/lib/theme";

/**
 * Barra superior: la navegación principal de la aplicación.
 *
 * Reemplaza a la barra lateral, que ocupaba ancho permanentemente para cuatro
 * secciones. Arriba el espacio ya estaba, y el ancho recuperado va donde de
 * verdad hace falta: la composición.
 *
 * Queda fija: se llega a cualquier sección sin importar cuánto hayas bajado.
 */

type Props = {
  game: Game;
  games: Game[];
  email: string | undefined;
  theme: Theme;
};

export function TopBar({ game, games, email, theme }: Props) {
  const pathname = usePathname();
  const [calcAbierta, setCalcAbierta] = useState(false);

  const base = `/app/${game.slug}`;

  const secciones = [
    { href: base, etiqueta: "Party Maker", icono: Users, exacto: false },
    { href: `${base}/builds`, etiqueta: "Builds", icono: Shirt, exacto: false },
    { href: `${base}/historial`, etiqueta: "Historial", icono: History, exacto: false },
  ];

  /** Party Maker cubre también las pantallas de contenido y de composición. */
  function activa(href: string): boolean {
    if (href === base) {
      return (
        pathname === base ||
        pathname.startsWith(`${base}/c/`) ||
        pathname.startsWith(`${base}/comp/`)
      );
    }
    return pathname.startsWith(href);
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-3 sm:px-4">
        <Link
          href="/"
          className="hidden shrink-0 text-lg font-semibold tracking-tight sm:block"
        >
          Albion<span className="text-accent">PM</span>
        </Link>

        <GameSwitcher game={game} games={games} />

        <nav aria-label="Secciones" className="flex min-w-0 flex-1 items-center gap-1">
          {secciones.map((seccion) => (
            <ItemNav
              key={seccion.href}
              href={seccion.href}
              activo={activa(seccion.href)}
              etiqueta={seccion.etiqueta}
              Icono={seccion.icono}
            />
          ))}

          <ItemNav
            onClick={() => setCalcAbierta((v) => !v)}
            activo={calcAbierta}
            etiqueta="Calculadora"
            Icono={CalculatorIcon}
          />
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden max-w-40 truncate text-sm text-muted lg:block">
            {email}
          </span>
          <ThemeToggle initial={theme} />
          <form action={signOut}>
            <button
              type="submit"
              className="h-11 rounded-lg border border-border px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text sm:h-9"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      {calcAbierta && <Calculator onClose={() => setCalcAbierta(false)} />}
    </>
  );
}

/**
 * Ítem de navegación.
 *
 * En pantallas chicas queda solo el ícono, con su etiqueta accesible; desde
 * `sm` aparece el texto. La marca de sección activa es una línea inferior, no
 * un cambio de color: el color solo no alcanza para quien no lo distingue.
 */
function ItemNav({
  href,
  onClick,
  activo,
  etiqueta,
  Icono,
}: {
  href?: string;
  onClick?: () => void;
  activo: boolean;
  etiqueta: string;
  Icono: React.ComponentType<{ size?: number }>;
}) {
  const clases = `relative flex h-11 items-center gap-2 rounded-lg px-2.5 text-sm transition-colors sm:px-3 ${
    activo ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text"
  }`;

  const contenido = (
    <>
      <Icono size={17} />
      <span className="hidden sm:inline">{etiqueta}</span>
      {activo && (
        <span
          aria-hidden
          className="absolute inset-x-2 -bottom-[9px] h-0.5 rounded-t bg-accent"
        />
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={clases}
        aria-label={etiqueta}
        aria-current={activo ? "page" : undefined}
      >
        {contenido}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={clases} aria-label={etiqueta}>
      {contenido}
    </button>
  );
}
