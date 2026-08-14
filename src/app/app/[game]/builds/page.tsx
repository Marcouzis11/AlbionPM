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

  return <BuildsLibrary gameId={game.id} folders={folders} builds={builds} roles={roles} />;
}
