"use client";

import { ChevronRight, Folder, FolderOpen, Search } from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";

import { Flotante } from "@/components/flotante";
import { ItemIcon } from "@/components/item-icon";
import {
  colorEfectivo,
  DISPOSICION_EQUIPO,
  type Build,
  type BuildFolder,
} from "@/lib/builds-shared";
import { textoSobre } from "@/lib/color";

/**
 * Elegir la build de una persona dentro de una composición.
 *
 * Una lista de nombres sueltos no alcanza. Las builds viven en carpetas y se
 * llaman parecido —«Maza», «Maza 2», «Maza avaloniana»—, así que el nombre solo
 * no distingue una de otra: hay que ver dónde está y qué lleva puesta.
 *
 * Por eso el menú trae las tres cosas: el árbol para ubicarse, el buscador para
 * cuando ya sabés el nombre, y el arma de cada una al lado del nombre para
 * reconocerla sin leer.
 */

/** Las piezas que alcanzan para reconocer una build de un vistazo. */
const CLAVE = ["mainhand", "offhand", "head", "armor", "shoes"] as const;

export function SelectorDeBuild({
  value,
  builds,
  folders,
  onChange,
  disabled = false,
  className = "",
}: {
  value: string | null;
  builds: Build[];
  folders: BuildFolder[];
  onChange: (buildId: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());
  const boton = useRef<HTMLButtonElement>(null);

  const elegida = builds.find((b) => b.id === value);
  const buscando = busqueda.trim() !== "";

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q === "" ? [] : builds.filter((b) => b.name.toLowerCase().includes(q));
  }, [builds, busqueda]);

  function alternar(id: string) {
    setPlegadas((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function elegir(buildId: string | null) {
    setAbierto(false);
    setBusqueda("");
    onChange(buildId);
  }

  function rama(parentId: string | null, nivel: number): React.ReactNode {
    const subcarpetas = folders.filter((f) => f.parent_id === parentId);
    const propias = builds.filter((b) => b.folder_id === parentId);

    return (
      <>
        {subcarpetas.map((f) => {
          const plegada = plegadas.has(f.id);
          return (
            <Fragment key={f.id}>
              <button
                type="button"
                onClick={() => alternar(f.id)}
                aria-expanded={!plegada}
                style={{ paddingLeft: nivel * 14 + 6 }}
                className="flex min-h-8 w-full items-center gap-1.5 rounded pr-2 text-left text-xs transition-colors hover:bg-surface-2"
              >
                <ChevronRight
                  size={12}
                  aria-hidden
                  className={`shrink-0 text-muted transition-transform ${
                    plegada ? "" : "rotate-90"
                  }`}
                />
                <span style={f.color ? { color: f.color } : undefined} className="shrink-0">
                  {plegada ? <Folder size={13} /> : <FolderOpen size={13} />}
                </span>
                <span className="truncate">{f.name}</span>
              </button>
              {!plegada && rama(f.id, nivel + 1)}
            </Fragment>
          );
        })}

        {propias.map((build) => (
          <Fila
            key={build.id}
            build={build}
            color={colorEfectivo(build, folders)}
            sangria={nivel * 14 + 6}
            elegida={build.id === value}
            onElegir={() => elegir(build.id)}
          />
        ))}
      </>
    );
  }

  return (
    <div className={className}>
      <button
        ref={boton}
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label="Build"
        className="flex h-full w-full items-center gap-1 rounded border border-border bg-surface px-1.5 text-left text-xs text-text disabled:opacity-60"
      >
        {elegida ? (
          <>
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: colorEfectivo(elegida, folders) ?? "var(--muted)" }}
            />
            <span className="min-w-0 flex-1 truncate">{elegida.name}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-muted">Build…</span>
        )}
        <ChevronRight size={12} aria-hidden className="shrink-0 rotate-90 text-muted" />
      </button>

      {abierto && (
        <Flotante
          ancla={boton}
          onCerrar={() => setAbierto(false)}
          className="flex max-h-96 w-80 flex-col p-2"
        >
          <div className="relative shrink-0">
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              autoFocus
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por nombre…"
              aria-label="Buscar build"
              className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-7 pr-2 text-xs"
            />
          </div>

          <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => elegir(null)}
              className={`flex min-h-8 w-full items-center rounded px-2 text-left text-xs transition-colors hover:bg-surface-2 ${
                value === null ? "font-medium" : "text-muted"
              }`}
            >
              Sin build
            </button>

            {buscando ? (
              resultados.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted">
                  Ninguna build se llama así.
                </p>
              ) : (
                resultados.map((build) => (
                  <Fila
                    key={build.id}
                    build={build}
                    color={colorEfectivo(build, folders)}
                    sangria={6}
                    elegida={build.id === value}
                    onElegir={() => elegir(build.id)}
                  />
                ))
              )
            ) : (
              rama(null, 0)
            )}
          </div>
        </Flotante>
      )}
    </div>
  );
}

/** Una build dentro del menú: su color, su nombre y lo que lleva puesto. */
function Fila({
  build,
  color,
  sangria,
  elegida,
  onElegir,
}: {
  build: Build;
  color: string | null;
  sangria: number;
  elegida: boolean;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      style={{ paddingLeft: sangria }}
      className={`flex min-h-10 w-full items-center gap-2 rounded pr-2 text-left transition-colors hover:bg-surface-2 ${
        elegida ? "bg-surface-2" : ""
      }`}
    >
      <span
        aria-hidden
        className="h-6 w-1 shrink-0 rounded-full"
        style={{ background: color ?? "var(--border)" }}
      />

      <span className="flex shrink-0 gap-0.5">
        {CLAVE.map((slot) =>
          build.items[slot] ? (
            <ItemIcon key={slot} item={build.items[slot]} size={40} className="size-5" />
          ) : (
            <span key={slot} className="size-5 rounded-sm border border-dashed border-border" />
          ),
        )}
      </span>

      <span className="min-w-0 flex-1 truncate text-xs">{build.name}</span>

      {color && (
        <span
          aria-hidden
          style={{ background: color, color: textoSobre(color) }}
          className="shrink-0 rounded px-1 text-[9px] font-medium"
        >
          {build.tags[0] ?? ""}
        </span>
      )}
    </button>
  );
}
