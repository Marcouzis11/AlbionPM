import Link from "next/link";
import { notFound } from "next/navigation";

import { listAllCompositions } from "@/lib/data/compositions";
import { getGameBySlug, listContents } from "@/lib/data/contents";

/**
 * Historial: todas las composiciones ordenadas por fecha, agrupadas por mes.
 *
 * Lo que hace reconocible una composición dentro de seis meses es su
 * descripción, así que se muestra completa y no recortada.
 */
export default async function HistorialPage({
  params,
}: PageProps<"/app/[game]/historial">) {
  const { game: slug } = await params;

  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const [compositions, contents] = await Promise.all([
    listAllCompositions(),
    listContents(game.id),
  ]);

  const contentById = new Map(contents.map((c) => [c.id, c]));

  const porMes = new Map<string, typeof compositions>();
  for (const comp of compositions) {
    const clave = new Intl.DateTimeFormat("es-AR", {
      month: "long",
      year: "numeric",
      timeZone: comp.event_tz,
    }).format(new Date(comp.event_at));
    porMes.set(clave, [...(porMes.get(clave) ?? []), comp]);
  }

  return (
    <div className="mx-auto h-full max-w-3xl space-y-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <p className="mt-1 text-sm text-muted">
          Las composiciones que compartiste, de la más reciente a la más vieja.
        </p>
      </div>

      {compositions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
          Todavía no hay nada acá. Una composición entra al historial cuando la
          compartís, que es cuando deja de ser un borrador.
        </div>
      ) : (
        [...porMes.entries()].map(([mes, comps]) => (
          <section key={mes} className="space-y-2">
            <h2 className="text-sm font-medium capitalize text-muted">{mes}</h2>
            <ul className="space-y-2">
              {comps.map((comp) => {
                const content = contentById.get(comp.content_id);
                return (
                  <li key={comp.id}>
                    <Link
                      href={`/app/${slug}/comp/${comp.id}`}
                      className="block rounded-lg border border-border bg-surface p-3 hover:border-accent"
                    >
                      <div className="flex items-center gap-2">
                        {comp.is_archived && <span title="Archivada">🔒</span>}
                        <span className="font-medium">{comp.name}</span>
                        {content && (
                          <span
                            className="rounded-lg px-2 py-0.5 text-[11px]"
                            style={{
                              background: `${content.color ?? "#888"}33`,
                              color: content.color ?? undefined,
                            }}
                          >
                            {content.name}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted">
                          {formatear(comp.event_at, comp.event_tz)}
                        </span>
                      </div>
                      {comp.description && (
                        <p className="mt-1 text-sm text-muted">{comp.description}</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function formatear(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString("es-AR");
  }
}
