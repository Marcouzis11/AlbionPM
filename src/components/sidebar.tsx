"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useState } from "react";

import { createContent, type ContentState } from "@/app/actions/contents";
import { Calculator } from "@/components/calculator";
import type { Content, Game } from "@/lib/data/contents";

/**
 * Barra lateral: el mapa de toda la aplicación.
 *
 * Tres secciones, como se definió: Party Maker (con los contenidos que crea
 * el usuario), Builds y Calculadora.
 */

const EMPTY: ContentState = {};

type Props = {
  game: Game;
  games: Game[];
  contents: Content[];
};

export function Sidebar({ game, games, contents }: Props) {
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  // Vive acá porque la barra lateral está en el layout: así el panel y lo que
  // llevabas sumado sobreviven a navegar entre composiciones.
  const [calcAbierta, setCalcAbierta] = useState(false);
  const [state, action, pending] = useActionState(createContent, EMPTY);

  const base = `/app/${game.slug}`;

  return (
    <nav className="flex w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4">
      <div>
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Albion<span className="text-accent">PM</span>
        </Link>
      </div>

      {/* Selector de juego. Hoy hay uno solo, pero el selector existe de verdad:
          agregarlo ahora es barato y retrofitearlo, carísimo. */}
      <label className="block">
        <span className="sr-only">Juego</span>
        <select
          value={game.slug}
          onChange={(event) => {
            window.location.href = `/app/${event.target.value}`;
          }}
          className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm"
        >
          {games.map((option) => (
            <option key={option.id} value={option.slug}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      <section className="flex-1 space-y-1">
        <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Party Maker
        </h2>

        {contents.length === 0 && !creating && (
          <p className="px-2 pb-2 text-xs leading-relaxed text-muted">
            Creá tu primer contenido: Gankeo, Castillo, CTA, lo que uses.
          </p>
        )}

        <ul className="space-y-0.5">
          {contents.map((content) => {
            const href = `${base}/c/${content.id}`;
            const active = pathname === href;
            return (
              <li key={content.id}>
                <Link
                  href={href}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    active ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2"
                  }`}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: content.color ?? "var(--muted)" }}
                  />
                  <span className="truncate">{content.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {creating ? (
          <form
            action={action}
            onSubmit={() => setCreating(false)}
            className="px-1 pt-1"
          >
            <input type="hidden" name="gameId" value={game.id} />
            <input
              name="name"
              autoFocus
              placeholder="Nombre del contenido"
              maxLength={60}
              onBlur={(event) => {
                if (!event.currentTarget.value.trim()) setCreating(false);
              }}
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
            />
            {state.error && (
              <p className="pt-1 text-xs text-danger">{state.error}</p>
            )}
            <p className="pt-1 text-[11px] text-muted">
              {pending ? "Creando…" : "Enter para crear, Esc para cancelar"}
            </p>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            + Nuevo contenido
          </button>
        )}
      </section>

      <section className="space-y-1 border-t border-border pt-4">
        <SidebarLink href={`${base}/builds`} active={pathname.startsWith(`${base}/builds`)}>
          Builds
        </SidebarLink>
        <SidebarLink
          href={`${base}/historial`}
          active={pathname.startsWith(`${base}/historial`)}
        >
          Historial
        </SidebarLink>

        <button
          type="button"
          onClick={() => setCalcAbierta((v) => !v)}
          className={`block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
            calcAbierta ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2 hover:text-text"
          }`}
        >
          Calculadora
        </button>
      </section>

      {calcAbierta && <Calculator onClose={() => setCalcAbierta(false)} />}
    </nav>
  );
}

function SidebarLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
        active ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}
