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

      {/* El scroll NO vive acá. Las pantallas de dos columnas necesitan que
          cada columna se desplace por su cuenta, y eso solo se puede si el
          armazón les da un alto definido en vez de crecer con el contenido.
          Cada pantalla se encarga de la suya. */}
      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto h-full w-full max-w-[110rem] px-4 py-6 sm:px-6 2xl:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
