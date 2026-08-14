"use client";

import { ChevronRight, Folder, FolderOpen, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import { createContent, type ContentState } from "@/app/actions/contents";
import { createComposition, type Plantilla } from "@/app/actions/compositions";
import type { Content } from "@/lib/data/contents";
import type { CompositionSummary } from "@/lib/data/compositions";

/**
 * Party Maker: los contenidos como carpetas que se abren.
 *
 * Cada contenido —Gankeo, CTA, Castillo— es un bloque. Al tocarlo se despliega
 * y muestra sus composiciones sin sacarte de la pantalla: podés mirar dentro de
 * dos contenidos a la vez y comparar, que es lo que hacés cuando buscás una
 * comp vieja para reutilizar.
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
  const [abiertos, setAbiertos] = useState<Set<string>>(
    // El primero arranca abierto: una pantalla de carpetas todas cerradas no
    // muestra nada de lo que la persona vino a buscar.
    () => new Set(contents.length > 0 ? [contents[0].id] : []),
  );
  const [nuevaEn, setNuevaEn] = useState<string | null>(null);
  const [state, action, pending] = useActionState(createContent, EMPTY);

  const porContenido = new Map<string, CompositionSummary[]>();
  for (const comp of compositions) {
    porContenido.set(comp.content_id, [
      ...(porContenido.get(comp.content_id) ?? []),
      comp,
    ]);
  }

  function alternar(id: string) {
    setAbiertos((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

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
            className="flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
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
          <Folder size={28} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 font-medium">Todavía no tenés contenidos</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Un contenido agrupa las composiciones de un mismo tipo de actividad.
            Creá los que uses en tu gremio: Gankeo, CTA, Castillo, Avaloniana.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {contents.map((content) => (
            <TarjetaContenido
              key={content.id}
              content={content}
              gameSlug={gameSlug}
              compositions={porContenido.get(content.id) ?? []}
              abierto={abiertos.has(content.id)}
              onAlternar={() => alternar(content.id)}
              creandoComp={nuevaEn === content.id}
              onCrearComp={() => setNuevaEn(content.id)}
              onCerrarCrear={() => setNuevaEn(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaContenido({
  content,
  gameSlug,
  compositions,
  abierto,
  onAlternar,
  creandoComp,
  onCrearComp,
  onCerrarCrear,
}: {
  content: Content;
  gameSlug: string;
  compositions: CompositionSummary[];
  abierto: boolean;
  onAlternar: () => void;
  creandoComp: boolean;
  onCrearComp: () => void;
  onCerrarCrear: () => void;
}) {
  const color = content.color ?? "var(--muted)";

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-surface"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <h2>
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={abierto}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
        >
          <span
            aria-hidden
            className="shrink-0"
            style={{ color }}
          >
            {abierto ? <FolderOpen size={20} /> : <Folder size={20} />}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{content.name}</span>
            <span className="block text-xs text-muted">
              {compositions.length === 0
                ? "Sin composiciones"
                : `${compositions.length} composición${compositions.length === 1 ? "" : "es"}`}
            </span>
          </span>

          <ChevronRight
            size={18}
            aria-hidden
            className={`shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none ${
              abierto ? "rotate-90" : ""
            }`}
          />
        </button>
      </h2>

      {/* La apertura anima la fila de la grilla de 0fr a 1fr. Es la forma de
          animar «alto automático» sin saltos ni alturas inventadas a mano. */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          abierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border px-3 py-2">
            {compositions.length === 0 && !creandoComp && (
              <p className="px-1 py-3 text-sm text-muted">
                Todavía no hay composiciones en {content.name}.
              </p>
            )}

            <ul className="space-y-1">
              {compositions.map((comp) => (
                <li key={comp.id}>
                  <Link
                    href={`/app/${gameSlug}/comp/${comp.id}`}
                    className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
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

            {creandoComp ? (
              <NuevaComposicion
                contentId={content.id}
                gameSlug={gameSlug}
                onCancelar={onCerrarCrear}
              />
            ) : (
              <button
                type="button"
                onClick={onCrearComp}
                className="mt-1 flex h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <Plus size={15} aria-hidden />
                Nueva composición
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
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
