"use client";

import { Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import { createContent, type ContentState } from "@/app/actions/contents";
import { createComposition, type Plantilla } from "@/app/actions/compositions";
import { GrillaCarpetas, type FichaDeCarpeta } from "@/components/carpetas";
import type { Content } from "@/lib/data/contents";
import type { CompositionSummary } from "@/lib/data/compositions";

/**
 * Party Maker: los contenidos son carpetas.
 *
 * Cada contenido —Gankeo, CTA, Castillo— es una carpeta en una grilla pareja.
 * Al abrirla, sus composiciones aparecen debajo de la grilla, sin sacarte de la
 * pantalla y sin mover ninguna carpeta de lugar.
 */

const EMPTY: ContentState = {};

const PLANTILLAS: { value: Plantilla; label: string; detalle: string }[] = [
  { value: "party20", label: "Party de 20", detalle: "Un grupo" },
  { value: "gremio", label: "Gremio", detalle: "Tres grupos de 20" },
  { value: "multigremio", label: "Multigremio", detalle: "Tres grupos, cada uno con su gremio" },
  { value: "vacia", label: "Vacía", detalle: "Un grupo sin lugares" },
];

export function PartyMaker({
  gameId,
  gameSlug,
  contents,
  compositions,
}: {
  gameId: string;
  gameSlug: string;
  contents: Content[];
  compositions: CompositionSummary[];
}) {
  const [creando, setCreando] = useState(false);
  const [state, action, pending] = useActionState(createContent, EMPTY);

  const porContenido = new Map<string, CompositionSummary[]>();
  for (const comp of compositions) {
    porContenido.set(comp.content_id, [
      ...(porContenido.get(comp.content_id) ?? []),
      comp,
    ]);
  }

  const carpetas: FichaDeCarpeta[] = contents.map((content) => {
    const suyas = porContenido.get(content.id) ?? [];
    return {
      id: content.id,
      nombre: content.name,
      color: content.color,
      detalle:
        suyas.length === 0
          ? "Sin composiciones"
          : `${suyas.length} composición${suyas.length === 1 ? "" : "es"}`,
      panel: () => (
        <ContenidoAbierto
          contentId={content.id}
          contentName={content.name}
          gameSlug={gameSlug}
          compositions={suyas}
        />
      ),
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Party Maker</h1>
          <p className="mt-1 text-sm text-muted">
            Tus contenidos, cada uno con sus composiciones adentro.
          </p>
        </div>

        {!creando && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover active:translate-y-px"
          >
            <Plus size={16} aria-hidden />
            Nuevo contenido
          </button>
        )}
      </div>

      {creando && (
        <form
          action={action}
          onSubmit={() => setCreando(false)}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3"
        >
          <input type="hidden" name="gameId" value={gameId} />
          <label htmlFor="nuevo-contenido" className="text-sm">
            Nombre del contenido
          </label>
          <input
            id="nuevo-contenido"
            name="name"
            autoFocus
            required
            maxLength={60}
            placeholder="Gankeo, CTA, Castillo…"
            className="h-11 min-w-52 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-60"
          >
            {pending ? "Creando…" : "Crear"}
          </button>
          <button
            type="button"
            onClick={() => setCreando(false)}
            className="h-11 rounded-lg border border-border px-4 text-sm hover:bg-surface-2"
          >
            Cancelar
          </button>
          {state.error && (
            <p role="alert" className="w-full text-sm text-danger">
              {state.error}
            </p>
          )}
        </form>
      )}

      {contents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium">Todavía no tenés contenidos</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Un contenido agrupa las composiciones de un mismo tipo de actividad.
            Creá los que uses en tu gremio: Gankeo, CTA, Castillo, Avaloniana.
          </p>
        </div>
      ) : (
        <GrillaCarpetas
          carpetas={carpetas}
          // La primera arranca abierta: una pantalla de carpetas todas
          // cerradas no muestra nada de lo que la persona vino a buscar.
          inicialAbierta={contents[0]?.id ?? null}
        />
      )}
    </div>
  );
}

/** Lo que hay dentro de un contenido abierto: sus composiciones. */
function ContenidoAbierto({
  contentId,
  contentName,
  gameSlug,
  compositions,
}: {
  contentId: string;
  contentName: string;
  gameSlug: string;
  compositions: CompositionSummary[];
}) {
  const [creando, setCreando] = useState(false);

  return (
    <>
      {compositions.length === 0 && !creando && (
        <p className="px-1 pb-2 text-sm text-muted">
          Todavía no hay composiciones en {contentName}.
        </p>
      )}

      {/* Entran escalonadas: se ve que salieron de la carpeta que abriste. */}
      <ul className="aparece-escalonado space-y-1">
        {compositions.map((comp) => (
          <li key={comp.id}>
            <Link
              href={`/app/${gameSlug}/comp/${comp.id}`}
              className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
            >
              {comp.is_archived && (
                <Lock size={13} className="shrink-0 text-accent" aria-label="Archivada" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{comp.name}</span>
                {comp.description && (
                  <span className="block truncate text-xs text-muted">
                    {comp.description}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {formatearCorta(comp.event_at, comp.event_tz)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {creando ? (
        <NuevaComposicion
          contentId={contentId}
          gameSlug={gameSlug}
          onCancelar={() => setCreando(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="mt-1 flex h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Plus size={15} aria-hidden />
          Nueva composición
        </button>
      )}
    </>
  );
}

function NuevaComposicion({
  contentId,
  gameSlug,
  onCancelar,
}: {
  contentId: string;
  gameSlug: string;
  onCancelar: () => void;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [plantilla, setPlantilla] = useState<Plantilla>("party20");
  const [pendiente, startTransition] = useTransition();

  function crear() {
    if (!nombre.trim()) return;
    startTransition(async () => {
      const result = await createComposition(
        contentId,
        nombre,
        plantilla,
        // Fecha, hora y zona salen de tu máquina, no del servidor, que puede
        // estar en otro continente.
        new Date().toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      if (result.id) router.push(`/app/${gameSlug}/comp/${result.id}`);
    });
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
      <div className="flex flex-wrap gap-2">
        <input
          autoFocus
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") crear();
            if (event.key === "Escape") onCancelar();
          }}
          placeholder="CTA del sábado"
          className="h-11 min-w-48 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
        />
        <select
          value={plantilla}
          onChange={(event) => setPlantilla(event.target.value as Plantilla)}
          aria-label="Plantilla"
          className="h-11 rounded-lg border border-border bg-surface px-2.5 text-sm"
        >
          {PLANTILLAS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} — {option.detalle}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={crear}
          disabled={pendiente || !nombre.trim()}
          className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-40"
        >
          {pendiente ? "Creando…" : "Crear"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="h-11 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function formatearCorta(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
