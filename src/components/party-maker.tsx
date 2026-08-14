"use client";

import { Lock, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import {
  createContent,
  deleteContentWithCompositions,
  renameContent,
  type ContentState,
} from "@/app/actions/contents";
import {
  createComposition,
  moveComposition,
  type Plantilla,
} from "@/app/actions/compositions";
import { propsDeArrastre } from "@/components/arrastre";
import { GrillaCarpetas, type FichaDeCarpeta } from "@/components/carpetas";
import { MoverA } from "@/components/mover-a";
import { colorSugerido, PALETA_CONTENIDOS } from "@/lib/color";
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

type Forma = {
  value: Plantilla;
  label: string;
  detalle: string;
  /** Cuántos grupos dibuja la miniatura. */
  grupos: number;
  /** Cuántos lugares tiene cada uno. Cero deja el grupo vacío. */
  lugares: number;
  /** Si cada grupo lleva su franja de gremio arriba. */
  conGremio: boolean;
};

const PLANTILLAS: Forma[] = [
  { value: "party20", label: "Party de 20", detalle: "Un grupo", grupos: 1, lugares: 20, conGremio: false },
  { value: "gremio", label: "Gremio", detalle: "Tres grupos de 20", grupos: 3, lugares: 20, conGremio: false },
  { value: "multigremio", label: "Multigremio", detalle: "Tres gremios", grupos: 3, lugares: 20, conGremio: true },
  { value: "vacia", label: "Vacía", detalle: "Un grupo sin lugares", grupos: 1, lugares: 0, conGremio: false },
];

/**
 * La plantilla, dibujada en chiquito.
 *
 * «Gremio» y «Multigremio» son dos palabras parecidas para dos cosas bastante
 * distintas, y el nombre solo no las separa. La miniatura sí: se ve de una que
 * una trae tres bloques y la otra tres bloques con su franja arriba. Cada punto
 * es un lugar, así que la diferencia entre veinte y ninguno también se ve.
 */
function MiniPlantilla({ forma }: { forma: Forma }) {
  return (
    <span aria-hidden className="flex items-end justify-center gap-1">
      {Array.from({ length: forma.grupos }, (_, grupo) => (
        <span
          key={grupo}
          className="flex w-8 flex-col gap-0.5 rounded border border-current/40 p-0.5"
        >
          {forma.conGremio && <span className="h-1 rounded-sm bg-current/70" />}
          {forma.lugares === 0 ? (
            <span className="h-6" />
          ) : (
            <span className="grid grid-cols-5 gap-px">
              {Array.from({ length: forma.lugares }, (_, lugar) => (
                <span key={lugar} className="aspect-square rounded-[1px] bg-current/60" />
              ))}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);
  const [borrando, setBorrando] = useState<ABorrar | null>(null);

  const [state, action, pending] = useActionState(createContent, EMPTY);

  function correr(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

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
      onRenombrar: (nombre) => correr(() => renameContent(content.id, nombre)),
      arrastre: {
        // Una carpeta acepta cualquier composición que hoy viva en otra.
        acepta: (dato) => dato.tipo === "composicion" && dato.origen !== content.id,
        alSoltar: (dato) => correr(() => moveComposition(dato.id, content.id)),
      },
      panel: () => (
        <ContenidoAbierto
          contentId={content.id}
          contentName={content.name}
          gameSlug={gameSlug}
          compositions={suyas}
          otrosContenidos={contents.filter((otro) => otro.id !== content.id)}
          onMover={(compId, destino) => correr(() => moveComposition(compId, destino))}
        />
      ),
      accion: (
        <button
          type="button"
          onClick={() => setBorrando({ content, compositions: suyas })}
          aria-label={`Borrar ${content.name}`}
          title={`Borrar ${content.name}`}
          className="flex size-7 items-center justify-center rounded-lg bg-surface/90 text-muted transition-colors hover:text-danger"
        >
          <Trash2 size={14} aria-hidden />
        </button>
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
          className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-3"
        >
          <input type="hidden" name="gameId" value={gameId} />

          <div className="flex flex-wrap items-center gap-2">
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
              className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover active:translate-y-px disabled:opacity-60"
            >
              {pending ? "Creando…" : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => setCreando(false)}
              className="h-11 rounded-lg border border-border px-4 text-sm transition-colors hover:bg-surface-2"
            >
              Cancelar
            </button>
          </div>

          <PaletaDeColores sugerido={colorSugerido(contents.length)} />

          {state.error && (
            <p role="alert" className="text-sm text-danger">
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
          vacio={{
            titulo: "Elegí una carpeta",
            detalle:
              "Tocá uno de tus contenidos para ver sus composiciones y crear una nueva.",
          }}
        />
      )}

      {borrando && (
        <DialogoBorrarContenido
          content={borrando.content}
          compositions={borrando.compositions}
          onCancel={() => setBorrando(null)}
        />
      )}
    </div>
  );
}

type ABorrar = { content: Content; compositions: CompositionSummary[] };

/**
 * Borrar un contenido con todo lo que tiene adentro.
 *
 * Un «¿estás seguro?» con un número no alcanza: «se borrarán 7 composiciones»
 * no te deja saber si entre esas siete está la que te costó tres horas armar.
 * Por eso se listan TODAS, con su fecha, y la lista es lo primero que se ve.
 *
 * Cuando hay algo que perder pide escribir el nombre. Es la única barrera que
 * un click distraído no pasa, y acá importa más que en otros lados: el plan de
 * la base no tiene copias de seguridad, así que esto es definitivo de verdad.
 */
function DialogoBorrarContenido({
  content,
  compositions,
  onCancel,
}: {
  content: Content;
  compositions: CompositionSummary[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const vacio = compositions.length === 0;
  const puede = vacio || texto.trim() === content.name;
  const compartidas = compositions.filter((comp) => comp.share_slug !== null).length;

  function borrar() {
    setError(null);
    startTransition(async () => {
      const resultado = await deleteContentWithCompositions(content.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      onCancel();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-borrar-contenido"
    >
      <div className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-xl border border-border bg-surface p-5">
        <h2 id="titulo-borrar-contenido" className="text-lg font-semibold">
          Borrar «{content.name}»
        </h2>

        {vacio ? (
          <p className="mt-3 text-sm text-muted">
            No tiene composiciones adentro. Se borra solo la carpeta.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm">
              Se borra la carpeta y{" "}
              <strong className="text-danger">
                {compositions.length === 1
                  ? "la composición que tiene adentro"
                  : `las ${compositions.length} composiciones que tiene adentro`}
              </strong>
              :
            </p>

            {/* La lista completa, con scroll propio. Que sea larga es
                justamente el motivo por el que hay que verla. */}
            <ul className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
              {compositions.map((comp) => (
                <li
                  key={comp.id}
                  className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0"
                >
                  {comp.is_archived && (
                    <Lock size={12} className="shrink-0 text-accent" aria-label="Archivada" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{comp.name}</span>
                    {comp.description && (
                      <span className="block truncate text-xs text-muted">
                        {comp.description}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {formatearCorta(comp.event_at, comp.event_tz)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 space-y-1.5 text-sm">
              <p className="text-success">
                Tus builds no se tocan. Siguen enteras en la biblioteca.
              </p>
              {compartidas > 0 && (
                <p className="text-muted">
                  {compartidas === 1
                    ? "Un link compartido deja de funcionar"
                    : `${compartidas} links compartidos dejan de funcionar`}
                  : quien lo abra no va a ver nada.
                </p>
              )}
              <p className="text-muted">
                Esto no se puede deshacer y no hay copias de seguridad.
              </p>
            </div>

            <label className="mt-3 block">
              <span className="text-xs text-muted">
                Para confirmar, escribí «{content.name}»
              </span>
              <input
                autoFocus
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm"
              />
            </label>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-lg border border-border px-4 text-sm transition-colors hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={borrar}
            disabled={!puede || pendiente}
            className="h-11 rounded-lg bg-danger px-4 text-sm font-medium text-white transition-opacity active:translate-y-px disabled:opacity-40"
          >
            {pendiente
              ? "Borrando…"
              : vacio
                ? "Borrar la carpeta"
                : `Borrar todo (${compositions.length + 1})`}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * El color del contenido, elegido al crearlo.
 *
 * Son botones de opción de verdad, escondidos debajo de la muestra: así las
 * flechas del teclado recorren la paleta y cada color tiene nombre para quien
 * no lo ve. Una fila de `div` con `onClick` se vería igual y no serviría para
 * nada de eso.
 *
 * Viene uno marcado: el que le tocaba por rotación. Elegir color no puede ser
 * un paso obligatorio para crear una carpeta.
 */
function PaletaDeColores({ sugerido }: { sugerido: string }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="float-left mr-2 text-sm">Color</legend>

      {PALETA_CONTENIDOS.map((color) => (
        <label
          key={color.hex}
          title={color.nombre}
          className="cursor-pointer leading-none"
        >
          <input
            type="radio"
            name="color"
            value={color.hex}
            defaultChecked={color.hex === sugerido}
            className="peer sr-only"
          />
          <span
            aria-hidden
            style={{ background: color.hex }}
            className="block size-8 rounded-lg ring-2 ring-transparent ring-offset-2 ring-offset-bg transition-[box-shadow] peer-checked:ring-text peer-focus-visible:ring-accent"
          />
          <span className="sr-only">{color.nombre}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Lo que hay dentro de un contenido abierto: sus composiciones. */
function ContenidoAbierto({
  contentId,
  contentName,
  gameSlug,
  compositions,
  otrosContenidos,
  onMover,
}: {
  contentId: string;
  contentName: string;
  gameSlug: string;
  compositions: CompositionSummary[];
  otrosContenidos: Content[];
  onMover: (composicionId: string, contenidoDestino: string) => void;
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
          <li
            key={comp.id}
            {...propsDeArrastre({
              tipo: "composicion",
              id: comp.id,
              origen: contentId,
            })}
            className="flex min-h-11 cursor-grab items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-surface-2 active:cursor-grabbing"
          >
            <Link
              href={`/app/${gameSlug}/comp/${comp.id}`}
              className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5"
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

            {otrosContenidos.length > 0 && (
              <MoverA
                etiqueta={`Mover ${comp.name} a otra carpeta`}
                destinos={otrosContenidos.map((otro) => ({
                  id: otro.id,
                  nombre: otro.name,
                }))}
                onMover={(destino) => onMover(comp.id, destino)}
              />
            )}
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
    <div className="mt-2 space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
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

      <fieldset>
        <legend className="sr-only">Plantilla</legend>
        <div className="flex flex-wrap gap-2">
          {PLANTILLAS.map((forma) => (
            <label
              key={forma.value}
              className={`flex w-[8.5rem] cursor-pointer flex-col items-center gap-2 rounded-lg border p-2.5 text-center transition-colors ${
                plantilla === forma.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:border-accent/60"
              }`}
            >
              <input
                type="radio"
                name="plantilla"
                value={forma.value}
                checked={plantilla === forma.value}
                onChange={() => setPlantilla(forma.value)}
                className="sr-only"
              />
              <MiniPlantilla forma={forma} />
              <span className="leading-tight">
                <span className="block text-xs font-medium text-text">{forma.label}</span>
                <span className="block text-[11px] text-muted">{forma.detalle}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
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
