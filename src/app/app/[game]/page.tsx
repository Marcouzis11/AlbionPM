import { notFound } from "next/navigation";

import { PartyMaker } from "@/components/party-maker";
import { listCompositionsForGame } from "@/lib/data/compositions";
import { getGameBySlug, listContents } from "@/lib/data/contents";

export default async function PartyMakerPage({ params }: PageProps<"/app/[game]">) {
  const { game: slug } = await params;

  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const [contents, compositions] = await Promise.all([
    listContents(game.id),
    listCompositionsForGame(game.id),
  ]);

  return (
    <PartyMaker
      gameId={game.id}
      gameSlug={slug}
      contents={contents}
      compositions={compositions}
    />
  );
}
