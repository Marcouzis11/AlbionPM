"use client";

import { Check, Copy, Eraser, Lock, Share2, TriangleAlert, Unlock } from "lucide-react";
import { useState, useTransition } from "react";

import { disableSharing, enableSharing } from "@/app/actions/share";
import { MAXIMO, nivelDisarray, perdidaPorcentual, UMBRAL } from "@/data/disarray";

/**
 * Encabezado de la composición: nombre, descripción, fecha, Disarray y
 * compartir, todo en una franja.
 *
 * Antes el Disarray y el panel de compartir eran dos columnas fijas de 256 px
 * a la derecha, que le comían el ancho a lo único que de verdad se edita: los
 * grupos. Acá quedan como dos pastillas que se abren solo cuando las mirás.
 */

export function CompHeader({
  compositionId,
  confirmados,
  lugares,
  shareSlug,
  visibility,
  bloqueado,
  onArchivar,
  onVaciar,
}: {
  compositionId: string;
  confirmados: number;
  lugares: number;
  shareSlug: string | null;
  visibility: "private" | "unlisted" | "public";
  bloqueado: boolean;
  onArchivar: () => void;
  onVaciar: () => void;
}) {
  const [panel, setPanel] = useState<"disarray" | "compartir" | null>(null);

  const nivel = nivelDisarray(confirmados);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pastilla
        activa={panel === "disarray"}
        onClick={() => setPanel(panel === "disarray" ? null : "disarray")}
        icono={<TriangleAlert size={15} aria-hidden />}
        etiqueta={`Disarray ${nivel.toFixed(1)}%`}
        detalle={`${confirmados}/${lugares}`}
      />

      <Pastilla
        activa={panel === "compartir"}
        onClick={() => setPanel(panel === "compartir" ? null : "compartir")}
        icono={<Share2 size={15} aria-hidden />}
        etiqueta="Compartir"
        detalle={visibility === "private" ? "Privada" : "Link activo"}
        resaltada={visibility !== "private"}
      />

      <button
        type="button"
        onClick={onArchivar}
        className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        {bloqueado ? <Unlock size={15} aria-hidden /> : <Lock size={15} aria-hidden />}
        <span className="hidden sm:inline">{bloqueado ? "Desarchivar" : "Archivar"}</span>
      </button>

      {!bloqueado && (
        <button
          type="button"
          onClick={onVaciar}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Eraser size={15} aria-hidden />
          <span className="hidden sm:inline">Vaciar</span>
        </button>
      )}

      {panel === "disarray" && (
        <PanelDisarray confirmados={confirmados} lugares={lugares} />
      )}

      {panel === "compartir" && (
        <PanelCompartir
          compositionId={compositionId}
          slug={shareSlug}
          visibility={visibility}
        />
      )}
    </div>
  );
}

function Pastilla({
  activa,
  resaltada,
  onClick,
  icono,
  etiqueta,
  detalle,
}: {
  activa: boolean;
  resaltada?: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  etiqueta: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={activa}
      className={`flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${
        activa || resaltada
          ? "border-accent/60 bg-accent/10 text-text"
          : "border-border text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      {icono}
      <span className="tabular-nums">{etiqueta}</span>
      <span className="text-xs text-muted">{detalle}</span>
    </button>
  );
}

function PanelDisarray({
  confirmados,
  lugares,
}: {
  confirmados: number;
  lugares: number;
}) {
  const [extra, setExtra] = useState(0);
  const [enemigos, setEnemigos] = useState(0);

  const total = confirmados + extra;
  const propio = nivelDisarray(total);
  const perdida = enemigos > 0 ? perdidaPorcentual(propio, nivelDisarray(enemigos)) : null;

  return (
    <div className="w-full rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {propio.toFixed(1)}
            <span className="text-base text-muted">%</span>
          </p>
          <p className="text-xs text-muted">
            {total <= UMBRAL
              ? `Arranca a partir de ${UMBRAL} jugadores`
              : propio >= MAXIMO
                ? "En el techo de la curva"
                : `Con ${total} jugadores`}
          </p>
        </div>

        <label className="text-xs text-muted">
          Aliados extra en la zona
          <input
            type="number"
            min={0}
            value={extra}
            onChange={(event) => setExtra(Math.max(0, Number(event.target.value) || 0))}
            className="mt-1 block h-10 w-28 rounded-lg border border-border bg-surface-2 px-2 text-sm tabular-nums text-text"
          />
        </label>

        <label className="text-xs text-muted">
          Tamaño del enemigo
          <input
            type="number"
            min={0}
            value={enemigos}
            onChange={(event) => setEnemigos(Math.max(0, Number(event.target.value) || 0))}
            className="mt-1 block h-10 w-28 rounded-lg border border-border bg-surface-2 px-2 text-sm tabular-nums text-text"
          />
        </label>

        {perdida !== null && (
          <p className="text-xs">
            {perdida <= 0 ? (
              <span className="text-success">Sin penalización contra ellos</span>
            ) : (
              <>
                Perdés{" "}
                <strong className="tabular-nums text-danger">{perdida}%</strong> de daño
              </>
            )}
          </p>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Estimado: depende de cuánta gente de tu alianza haya en la zona, no solo de
        esta composición. Cuentan los lugares con nombre escrito —{confirmados} de{" "}
        {lugares}—.
      </p>
    </div>
  );
}

function PanelCompartir({
  compositionId,
  slug,
  visibility,
}: {
  compositionId: string;
  slug: string | null;
  visibility: "private" | "unlisted" | "public";
}) {
  const [, startTransition] = useTransition();
  const [slugActual, setSlugActual] = useState(slug);
  const [visActual, setVisActual] = useState(visibility);
  const [copiado, setCopiado] = useState(false);

  const compartida = visActual !== "private" && slugActual !== null;
  const url =
    typeof window !== "undefined" && slugActual
      ? `${window.location.origin}/p/${slugActual}`
      : "";

  return (
    <div className="w-full rounded-xl border border-border bg-surface p-3">
      {!compartida ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-muted">
            Generá un link para que tu gremio vea la composición sin registrarse.
            Cada jugador se busca por su nombre y ve su build, su grupo y su líder.
          </p>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                const result = await enableSharing(compositionId, "unlisted");
                if (result.slug) {
                  setSlugActual(result.slug);
                  setVisActual("unlisted");
                }
              })
            }
            className="h-10 shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover"
          >
            Generar link
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Link para compartir"
            className="h-10 min-w-52 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 font-mono text-xs"
          />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg"
          >
            {copiado ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
          >
            Ver como el jugador
          </a>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await disableSharing(compositionId);
                setVisActual("private");
              })
            }
            className="h-10 rounded-lg px-2 text-xs text-muted underline underline-offset-2 hover:text-danger"
          >
            Dejar de compartir
          </button>
        </div>
      )}
    </div>
  );
}
