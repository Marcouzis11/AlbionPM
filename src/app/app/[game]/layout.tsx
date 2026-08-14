import { notFound } from "next/navigation";

import { TopBar } from "@/components/top-bar";
import { getGameBySlug, listGames } from "@/lib/data/contents";
import { createClient } from "@/lib/supabase/server";
import { readTheme } from "@/lib/theme-server";

/**
 * Armazón de la aplicación.
 *
 * La navegación es una barra superior fija; debajo, el contenido con su propio
 * scroll. Se limita al alto de la ventana (`h-dvh`, no `min-h`) para que la
 * barra no se vaya hacia arriba al bajar dentro de una composición larga.
 *
 * `dvh` y no `vh` porque en el celular la barra del navegador aparece y
 * desaparece, y con `vh` el pie del contenido queda tapado.
 */
export default async function GameLayout({
  children,
  params,
}: LayoutProps<"/app/[game]">) {
  const { game: slug } = await params;

  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const [games, theme, supabase] = await Promise.all([
    listGames(),
    readTheme(),
    createClient(),
  ]);

  const { data } = await supabase.auth.getUser();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar game={game} games={games} email={data.user?.email} theme={theme} />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
