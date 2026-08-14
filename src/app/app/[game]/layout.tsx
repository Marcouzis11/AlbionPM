import { notFound } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getGameBySlug, listContents, listGames } from "@/lib/data/contents";
import { createClient } from "@/lib/supabase/server";
import { readTheme } from "@/lib/theme-server";

export default async function GameLayout({
  children,
  params,
}: LayoutProps<"/app/[game]">) {
  const { game: slug } = await params;

  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const [games, contents, theme, supabase] = await Promise.all([
    listGames(),
    listContents(game.id),
    readTheme(),
    createClient(),
  ]);

  const { data } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar game={game} games={games} contents={contents} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-border px-6 py-3">
          <span className="truncate text-sm text-muted">{data.user?.email}</span>
          <ThemeToggle initial={theme} />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              Salir
            </button>
          </form>
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
