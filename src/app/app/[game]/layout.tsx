import { notFound } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getGameBySlug, listContents, listGames } from "@/lib/data/contents";
import { readSidebarMode } from "@/lib/sidebar-server";
import { createClient } from "@/lib/supabase/server";
import { readTheme } from "@/lib/theme-server";

/**
 * Armazón de la aplicación.
 *
 * La barra lateral y el encabezado quedan fijos en pantalla; lo único que
 * scrollea es el panel de contenido. Por eso el contenedor se limita al alto
 * de la ventana (`h-dvh` y no `min-h`) y el scroll vive adentro: si la página
 * entera creciera, la barra se iría hacia arriba al bajar en una composición
 * de tres grupos.
 *
 * `dvh` y no `vh` porque en el celular la barra del navegador aparece y
 * desaparece, y con `vh` el pie queda tapado.
 */
export default async function GameLayout({
  children,
  params,
}: LayoutProps<"/app/[game]">) {
  const { game: slug } = await params;

  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const [games, contents, theme, sidebarMode, supabase] = await Promise.all([
    listGames(),
    listContents(game.id),
    readTheme(),
    readSidebarMode(),
    createClient(),
  ]);

  const { data } = await supabase.auth.getUser();

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        game={game}
        games={games}
        contents={contents}
        initialMode={sidebarMode}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border px-5">
          <span className="hidden truncate text-sm text-muted sm:block">
            {data.user?.email}
          </span>
          <ThemeToggle initial={theme} />
          <form action={signOut}>
            <button
              type="submit"
              className="h-8 rounded-lg border border-border px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              Salir
            </button>
          </form>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
