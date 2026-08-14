import Link from "next/link";
import { notFound } from "next/navigation";

import { CompositionEditor } from "@/components/composition-editor";
import { listBuilds, listRoles } from "@/lib/data/builds";
import { getComposition } from "@/lib/data/compositions";
import { getGameBySlug } from "@/lib/data/contents";

export default async function CompositionPage({
  params,
}: PageProps<"/app/[game]/comp/[compId]">) {
  const { game: slug, compId } = await params;

  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const [composition, builds, roles] = await Promise.all([
    getComposition(compId),
    listBuilds(game.id),
    listRoles(game.id),
  ]);

  if (!composition) notFound();

  return (
    <div className="h-full space-y-4 overflow-y-auto">
      <Link
        href={`/app/${slug}`}
        className="text-sm text-muted hover:text-text"
      >
        ← Volver al Party Maker
      </Link>

      <CompositionEditor composition={composition} builds={builds} roles={roles} />
    </div>
  );
}
