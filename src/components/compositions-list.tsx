"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createComposition,
  deleteComposition,
  duplicateComposition,
  type Plantilla,
} from "@/app/actions/compositions";
import type { CompositionSummary } from "@/lib/data/compositions";

const PLANTILLAS: { value: Plantilla; label: string; detalle: string }[] = [
  { value: "party20", label: "Party de 20", detalle: "Un grupo, el caso más común" },
  { value: "gremio", label: "Gremio", detalle: "Tres grupos de 20 de tu gremio" },
  {
    value: "multigremio",
    label: "Multigremio",
    detalle: "Tres grupos, cada uno con su gremio, para coordinar una guerra",
  },
  { value: "vacia", label: "Vacía", detalle: "Un grupo sin lugares, para armar desde cero" },
];

export function CompositionsList({
  gameSlug,
  contentId,
  contentName,
  compositions,
  contents,
}: {
  gameSlug: string;
  contentId: string;
  contentName: string;
  compositions: CompositionSummary[];
  contents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

  function crear(nombre: string, plantilla: Plantilla) {
    startTransition(async () => {
      // La fecha, la hora y la zona salen de la máquina del usuario, no del
      // servidor: es SU hora la que importa para una CTA.
      const result = await createComposition(
        contentId,
        nombre,
        plantilla,
        new Date().toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      setCreando(false);
      if (result.id) router.push(`/app/${gameSlug}/comp/${result.id}`);
    });
  }

  function accion(fn: () => Promise<unknown>) {
    setMenuAbierto(null);
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{contentName}</h1>
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover"
        >
          + Nueva composición
        </button>
      </div>

      {compositions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
          Todavía no hay composiciones en {contentName}.
        </div>
      ) : (
        <ul className="space-y-2">
          {compositions.map((comp) => (
            <li
              key={comp.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <Link href={`/app/${gameSlug}/comp/${comp.id}`} className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium">
                  {comp.is_archived && <span title="Archivada">🔒</span>}
                  {comp.name}
                </p>
                <p className="truncate text-xs text-muted">
                  {formatearFecha(comp.event_at, comp.event_tz)}
                  {comp.description && ` · ${comp.description}`}
                </p>
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuAbierto(menuAbierto === comp.id ? null : comp.id)}
                  aria-label="Acciones"
                  className="rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-surface-2"
                >
                  ···
                </button>

                {menuAbierto === comp.id && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-border bg-surface p-1 shadow-xl">
                    <MenuItem
                      onClick={() =>
                        accion(() => duplicateComposition(comp.id, { conBuilds: true }))
                      }
                    >
                      Duplicar
                    </MenuItem>
                    <MenuItem
                      onClick={() =>
                        accion(() => duplicateComposition(comp.id, { conBuilds: false }))
                      }
                      detalle="Conserva grupos, roles y nombres"
                    >
                      Duplicar sin builds
                    </MenuItem>

                    {contents.filter((c) => c.id !== contentId).length > 0 && (
                      <>
                        <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wider text-muted">
                          Copiar a
                        </p>
                        {contents
                          .filter((c) => c.id !== contentId)
                          .map((destino) => (
                            <MenuItem
                              key={destino.id}
                              onClick={() =>
                                accion(() =>
                                  duplicateComposition(comp.id, {
                                    conBuilds: true,
                                    contentId: destino.id,
                                  }),
                                )
                              }
                            >
                              {destino.name}
                            </MenuItem>
                          ))}
                      </>
                    )}

                    <div className="my-1 border-t border-border" />
                    <MenuItem
                      onClick={() => accion(() => deleteComposition(comp.id))}
                      peligro
                      detalle={comp.is_archived ? "Hay que desarchivarla primero" : undefined}
                    >
                      Borrar
                    </MenuItem>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {creando && <DialogoNueva onCancel={() => setCreando(false)} onCrear={crear} />}
    </div>
  );
}

function MenuItem({
  children,
  detalle,
  peligro,
  onClick,
}: {
  children: React.ReactNode;
  detalle?: string;
  peligro?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-surface-2 ${
        peligro ? "text-danger" : ""
      }`}
    >
      {children}
      {detalle && <span className="block text-[11px] text-muted">{detalle}</span>}
    </button>
  );
}

function DialogoNueva({
  onCancel,
  onCrear,
}: {
  onCancel: () => void;
  onCrear: (nombre: string, plantilla: Plantilla) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [plantilla, setPlantilla] = useState<Plantilla>("party20");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Nueva composición</h2>

        <label className="mt-4 block">
          <span className="text-sm">Nombre</span>
          <input
            autoFocus
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="CTA del sábado"
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm">Plantilla</legend>
          <div className="mt-2 space-y-1">
            {PLANTILLAS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-2 rounded-lg border p-2.5 text-sm ${
                  plantilla === option.value ? "border-accent bg-accent/10" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="plantilla"
                  checked={plantilla === option.value}
                  onChange={() => setPlantilla(option.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="block text-xs text-muted">{option.detalle}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onCrear(nombre, plantilla)}
            disabled={!nombre.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

function formatearFecha(iso: string, tz: string): string {
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
