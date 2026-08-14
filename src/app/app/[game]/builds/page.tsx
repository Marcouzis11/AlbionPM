import { notFound } from "next/navigation";

import { BuildsLibrary } from "@/components/builds-library";
import { listBuilds, listFolders, listRoles } from "@/lib/data/builds";
import { getGameBySlug } from "@/lib/data/contents";

export default async function BuildsPage({ params }: PageProps<"/app/[game]/builds">) {
  const { game: slug } = await params;

  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const [folders, builds, roles] = await Promise.all([
    listFolders(game.id),
    listBuilds(game.id),
    listRoles(game.id),
  ]);

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Builds</h1>
        <p className="mt-1 text-sm text-muted">
          Organizalas en carpetas, ponles tags y un color. El color pinta la fila de esa
          persona en todas las composiciones donde uses la build.
        </p>
      </div>

      <BuildsLibrary gameId={game.id} folders={folders} builds={builds} roles={roles} />
    </div>
  );
}
