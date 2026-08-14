"use client";

import { useState, useTransition } from "react";

import { disableSharing, enableSharing, updateShareFormats } from "@/app/actions/share";
import type { ShareFormats } from "@/lib/shared-composition";

/**
 * Panel para compartir una composición.
 *
 * El dueño decide qué formatos ofrece la vista pública: el link siempre está,
 * el PDF y la imagen son opcionales.
 */
export function SharePanel({
  compositionId,
  slug,
  visibility,
  formats,
}: {
  compositionId: string;
  slug: string | null;
  visibility: "private" | "unlisted" | "public";
  formats: ShareFormats;
}) {
  const [, startTransition] = useTransition();
  const [slugActual, setSlugActual] = useState(slug);
  const [visActual, setVisActual] = useState(visibility);
  const [formatosActuales, setFormatos] = useState<ShareFormats>(formats ?? {});
  const [copiado, setCopiado] = useState(false);

  const compartida = visActual !== "private" && slugActual !== null;
  const url =
    typeof window !== "undefined" && slugActual
      ? `${window.location.origin}/p/${slugActual}`
      : "";

  function activar() {
    startTransition(async () => {
      const result = await enableSharing(compositionId, "unlisted");
      if (result.slug) {
        setSlugActual(result.slug);
        setVisActual("unlisted");
      }
    });
  }

  function desactivar() {
    startTransition(async () => {
      await disableSharing(compositionId);
      setVisActual("private");
    });
  }

  function alternarFormato(clave: keyof ShareFormats) {
    const siguiente = { ...formatosActuales, [clave]: formatosActuales[clave] === false };
    setFormatos(siguiente);
    startTransition(() => void updateShareFormats(compositionId, siguiente));
  }

  async function copiar() {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (!compartida) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-sm font-medium">Compartir</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Generá un link para que tu gremio vea la composición sin registrarse. Cada
          jugador se busca por su nombre y ve su build, su grupo y su líder.
        </p>
        <button
          type="button"
          onClick={activar}
          className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover"
        >
          Generar link
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-medium">Compartir</h3>

      <div className="flex gap-1.5">
        <input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-xs"
        />
        <button
          type="button"
          onClick={copiar}
          className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg"
        >
          {copiado ? "✓" : "Copiar"}
        </button>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block text-xs text-accent underline underline-offset-2"
      >
        Abrir como lo ve el jugador
      </a>

      <div>
        <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
          Formatos que ofrece
        </span>
        <div className="space-y-1">
          {(
            [
              ["pdf", "PDF para imprimir o guardar"],
              ["png", "Imagen para pegar en Discord"],
            ] as const
          ).map(([clave, texto]) => (
            <label key={clave} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={formatosActuales[clave] !== false}
                onChange={() => alternarFormato(clave)}
              />
              {texto}
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={desactivar}
        className="text-xs text-muted underline underline-offset-2 hover:text-danger"
      >
        Dejar de compartir
      </button>
      <p className="text-[11px] leading-relaxed text-muted">
        El link deja de funcionar, pero se conserva: si volvés a compartir, es el mismo
        y los que ya lo tenían no se quedan afuera.
      </p>
    </div>
  );
}
