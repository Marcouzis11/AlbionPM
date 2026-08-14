import { notFound } from "next/navigation";

import { CompositionsList } from "@/components/compositions-list";
import { listCompositions } from "@/lib/data/compositions";
import { getGameBySlug, listContents } from "@/lib/data/contents";

export default async function ContentPage({
  params,
}: PageProps<"/app/[game]/c/[contentId]">) {
  const { game: slug, contentId } = await params;

  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const [contents, compositions] = await Promise.all([
    listContents(game.id),
    listCompositions(contentId),
  ]);

  const content = contents.find((c) => c.id === contentId);
  if (!content) notFound();

  return (
    <CompositionsList
      gameSlug={slug}
      contentId={contentId}
      contentName={content.name}
      compositions={compositions}
      contents={contents.map(({ id, name }) => ({ id, name }))}
    />
  );
}
