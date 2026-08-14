"use client";

import {
  Calculator as CalculatorIcon,
  ChevronsLeft,
  ChevronsRight,
  History,
  Plus,
  Shirt,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import { createContent, type ContentState } from "@/app/actions/contents";
import { setSidebarMode } from "@/app/actions/sidebar";
import { Calculator } from "@/components/calculator";
import type { Content, Game } from "@/lib/data/contents";
import { SIDEBAR_WIDTH, type SidebarMode } from "@/lib/sidebar";

/**
 * Barra lateral: el mapa de toda la aplicación.
 *
 * Dos modos. En **amplio** se lee el nombre de cada cosa. En **fino** quedan
 * solo los íconos, y ahí el detalle que hace que funcione: los contenidos se
 * identifican por el color que vos mismo les pusiste, no por un ícono genérico
 * repetido. La navegación termina siendo tuya y no de la aplicación.
 *
 * Ocupa siempre el alto de la pantalla y no depende de lo que haya a la
 * derecha: el contenido scrollea en su propio panel.
 */

const EMPTY: ContentState = {};

type Props = {
  game: Game;
  games: Game[];
  contents: Content[];
  initialMode: SidebarMode;
};

export function Sidebar({ game, games, contents, initialMode }: Props) {
  const pathname = usePathname();
  const [modo, setModo] = useState<SidebarMode>(initialMode);
  const [creating, setCreating] = useState(false);
  // Vive acá porque la barra está en el layout: lo que llevabas sumado
  // sobrevive a navegar entre composiciones.
  const [calcAbierta, setCalcAbierta] = useState(false);
  const [state, action, pending] = useActionState(createContent, EMPTY);
  const [, startTransition] = useTransition();

  const fino = modo === "thin";
  const base = `/app/${game.slug}`;

  function alternar() {
    const siguiente: SidebarMode = fino ? "wide" : "thin";
    setModo(siguiente);
    if (siguiente === "wide") setCreating(false);
    startTransition(() => void setSidebarMode(siguiente));
  }

  return (
    <nav
      aria-label="Navegación principal"
      style={{ width: SIDEBAR_WIDTH[modo] }}
      className="sticky top-0 flex h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 motion-reduce:transition-none"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <Link
          href="/"
          title="AlbionPM"
          className="min-w-0 truncate text-lg font-semibold tracking-tight"
        >
          {fino ? (
            <span className="text-accent">A</span>
          ) : (
            <>
              Albion<span className="text-accent">PM</span>
            </>
          )}
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3">
        {!fino && (
          <div className="px-3 pb-3">
            <label className="block">
              <span className="sr-only">Juego</span>
              <select
                value={game.slug}
                onChange={(event) => {
                  window.location.href = `/app/${event.target.value}`;
                }}
                className="h-8 w-full rounded-lg border border-border bg-surface-2 px-2 text-sm"
              >
                {games.map((option) => (
                  <option key={option.id} value={option.slug}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <Seccion titulo="Party Maker" fino={fino} />

        <ul className="space-y-0.5 px-2">
          {contents.map((content) => {
            const href = `${base}/c/${content.id}`;
            return (
              <li key={content.id}>
                <Fila
                  href={href}
                  activo={pathname === href}
                  fino={fino}
                  etiqueta={content.name}
                  icono={
                    // El color del contenido ES el ícono. En modo fino, un
                    // disco de color se reconoce de un vistazo; nueve íconos
                    // grises iguales, no.
                    <span
                      aria-hidden
                      className="size-3 rounded-full ring-2 ring-inset ring-black/20"
                      style={{ background: content.color ?? "var(--muted)" }}
                    />
                  }
                />
              </li>
            );
          })}
        </ul>

        {creating && !fino ? (
          <form action={action} onSubmit={() => setCreating(false)} className="px-3 pt-1">
            <input type="hidden" name="gameId" value={game.id} />
            <input
              name="name"
              autoFocus
              placeholder="Gankeo, CTA, Castillo…"
              maxLength={60}
              onKeyDown={(event) => event.key === "Escape" && setCreating(false)}
              onBlur={(event) => {
                if (!event.currentTarget.value.trim()) setCreating(false);
              }}
              className="h-8 w-full rounded-md border border-border bg-surface-2 px-2 text-sm"
            />
            {state.error && <p className="pt-1 text-xs text-danger">{state.error}</p>}
            <p className="pt-1 text-[11px] text-muted">
              {pending ? "Creando…" : "Enter para crear"}
            </p>
          </form>
        ) : (
          <div className="px-2 pt-0.5">
            <Fila
              onClick={() => {
                if (fino) alternar();
                setCreating(true);
              }}
              fino={fino}
              etiqueta="Nuevo contenido"
              icono={<Plus size={16} />}
              tenue
            />
          </div>
        )}

        <div className="my-3 border-t border-border" />

        <ul className="space-y-0.5 px-2">
          <li>
            <Fila
              href={`${base}/builds`}
              activo={pathname.startsWith(`${base}/builds`)}
              fino={fino}
              etiqueta="Builds"
              icono={<Shirt size={16} />}
            />
          </li>
          <li>
            <Fila
              href={`${base}/historial`}
              activo={pathname.startsWith(`${base}/historial`)}
              fino={fino}
              etiqueta="Historial"
              icono={<History size={16} />}
            />
          </li>
          <li>
            <Fila
              onClick={() => setCalcAbierta((v) => !v)}
              activo={calcAbierta}
              fino={fino}
              etiqueta="Calculadora"
              icono={<CalculatorIcon size={16} />}
            />
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={alternar}
        aria-label={fino ? "Ampliar la barra lateral" : "Achicar la barra lateral"}
        aria-expanded={!fino}
        className="flex h-10 shrink-0 items-center justify-center gap-2 border-t border-border text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        {fino ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        {!fino && <span className="text-xs">Achicar</span>}
      </button>

      {calcAbierta && <Calculator onClose={() => setCalcAbierta(false)} />}
    </nav>
  );
}

function Seccion({ titulo, fino }: { titulo: string; fino: boolean }) {
  if (fino) {
    // En modo fino el título se reemplaza por una línea: el espacio no alcanza
    // para leerlo, pero la separación entre grupos sí tiene que notarse.
    return <div className="mx-3 mb-1.5 border-t border-border" />;
  }
  return (
    <h2 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
      {titulo}
    </h2>
  );
}

/**
 * Una fila de la barra. Sirve para enlaces y para botones, porque visualmente
 * son la misma cosa y separarlos duplicaría el estilo y el comportamiento.
 */
function Fila({
  href,
  onClick,
  activo,
  fino,
  etiqueta,
  icono,
  tenue,
}: {
  href?: string;
  onClick?: () => void;
  activo?: boolean;
  fino: boolean;
  etiqueta: string;
  icono: React.ReactNode;
  tenue?: boolean;
}) {
  const clases = `group relative flex h-9 w-full items-center rounded-md text-sm transition-colors ${
    fino ? "justify-center px-0" : "gap-2.5 px-2.5"
  } ${
    activo
      ? "bg-surface-2 text-text"
      : `${tenue ? "text-muted/70" : "text-muted"} hover:bg-surface-2 hover:text-text`
  }`;

  const contenido = (
    <>
      {/* Marca de activo a la izquierda. Funciona igual en los dos modos, que
          es justamente lo que un fondo de color solo no logra en el fino. */}
      {activo && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent"
        />
      )}
      <span className="flex size-4 shrink-0 items-center justify-center">{icono}</span>
      {!fino && <span className="min-w-0 flex-1 truncate text-left">{etiqueta}</span>}

      {/* En modo fino, el nombre aparece al pasar el mouse. Sin esto, un ícono
          sin texto obliga a adivinar. */}
      {fino && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full z-40 ml-2 hidden whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs text-text shadow-lg group-hover:block group-focus-visible:block"
        >
          {etiqueta}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={clases} aria-label={fino ? etiqueta : undefined}>
        {contenido}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={clases}
      aria-label={fino ? etiqueta : undefined}
    >
      {contenido}
    </button>
  );
}
