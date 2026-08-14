import { getGameBySlug, listContents } from "@/lib/data/contents";

export default async function GameHome({ params }: PageProps<"/app/[game]">) {
  const { game: slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return null;

  const contents = await listContents(game.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{game.name}</h1>
        <p className="mt-1 text-muted">
          Organizá tus partys por tipo de contenido.
        </p>
      </div>

      {contents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-muted">
            Todavía no creaste ningún contenido.
          </p>
          <p className="mt-2 text-sm text-muted">
            Usá <strong className="text-text">+ Nuevo contenido</strong> en la barra
            lateral para crear los tuyos: Gankeo, Castillo, Avaloniana, CTA, Guerra…
            los que uses en tu gremio.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Elegí un contenido en la barra lateral para ver sus composiciones.
        </p>
      )}
    </div>
  );
}
