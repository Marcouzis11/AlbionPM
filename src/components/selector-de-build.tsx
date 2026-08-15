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
  type Role,
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

/** Siglas de los casilleros vacíos, iguales a las de la biblioteca. */
const SIGLAS: Record<string, string> = {
  mainhand: "Arma",
  offhand: "Off",
  head: "Cab",
  armor: "Pech",
  shoes: "Bot",
  cape: "Capa",
  food: "Com",
  potion: "Poc",
  mount: "Mont",
};

export function SelectorDeBuild({
  value,
  builds,
  folders,
  roles,
  onChange,
  disabled = false,
  className = "",
}: {
  value: string | null;
  builds: Build[];
  folders: BuildFolder[];
  roles: Role[];
  onChange: (buildId: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const rolDe = (build: Build) =>
    build.role_id ? roles.find((r) => r.id === build.role_id)?.name : undefined;

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

        {propias.length > 0 && (
          <div
            className="grid grid-cols-2 gap-1.5 py-1"
            style={{ marginLeft: nivel * 14 + 6 }}
          >
            {propias.map((build) => (
              <Tarjeta
                key={build.id}
                build={build}
                color={colorEfectivo(build, folders)}
                rol={rolDe(build)}
                elegida={build.id === value}
                onElegir={() => elegir(build.id)}
              />
            ))}
          </div>
        )}
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
          className="flex max-h-[26rem] w-80 flex-col p-2"
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
                <div className="grid grid-cols-2 gap-1.5 py-1">
                  {resultados.map((build) => (
                    <Tarjeta
                      key={build.id}
                      build={build}
                      color={colorEfectivo(build, folders)}
                      rol={rolDe(build)}
                      elegida={build.id === value}
                      onElegir={() => elegir(build.id)}
                    />
                  ))}
                </div>
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

/**
 * Una build dentro del menú, con la misma forma que en la biblioteca.
 *
 * Sin descripción: acá estás eligiendo, no leyendo. Alcanza con el equipo para
 * reconocerla, el nombre para confirmarla y el rol para no confundir dos que se
 * parecen. La nota entera haría el menú tres veces más largo justo cuando lo
 * que querés es cerrarlo rápido.
 */
function Tarjeta({
  build,
  color,
  rol,
  elegida,
  onElegir,
}: {
  build: Build;
  color: string | null;
  rol: string | undefined;
  elegida: boolean;
  onElegir: () => void;
}) {
  const estilo = color
    ? { background: color, color: textoSobre(color) }
    : undefined;

  return (
    <button
      type="button"
      onClick={onElegir}
      style={estilo}
      className={`flex flex-col gap-1 rounded-lg border p-1.5 text-left ${
        color ? "border-current/25" : "border-border bg-surface"
      } ${elegida ? "ring-2 ring-accent" : ""}`}
    >
      <span className="grid w-full grid-cols-3">
        {DISPOSICION_EQUIPO.flat().map((slot, indice) =>
          slot === null ? (
            <span key={`hueco-${indice}`} aria-hidden />
          ) : build.items[slot] ? (
            <ItemIcon
              key={slot}
              item={build.items[slot]}
              size={64}
              className="h-auto w-full"
            />
          ) : (
            <span
              key={slot}
              className="m-px flex aspect-square items-center justify-center rounded-sm border border-dashed border-current/30 text-[7px] font-semibold leading-none opacity-70"
            >
              {SIGLAS[slot]}
            </span>
          ),
        )}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{build.name}</span>
        <span className={`block truncate text-[10px] ${color ? "opacity-80" : "text-muted"}`}>
          {rol ?? "Sin rol"}
        </span>
      </span>
    </button>
  );
}
