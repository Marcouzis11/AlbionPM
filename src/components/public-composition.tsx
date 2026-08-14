"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ItemIcon } from "@/components/item-icon";
import { EQUIPMENT_SLOTS, type EquipmentSlot } from "@/lib/items";
import {
  buscarJugador,
  formatearEvento,
  type SharedComposition,
  type SharedSlot,
} from "@/lib/shared-composition";

/**
 * Vista pública de una composición. Es la pantalla que justifica el proyecto.
 *
 * Todo el trabajo del líder existe para que alguien abra esto desde el celular,
 * con poca señal, cinco minutos antes de la CTA, y sepa en treinta segundos qué
 * hacer. Por eso la composición entera llega ya renderizada desde el servidor y
 * el buscador filtra sobre datos que ya están en la página: ni una petición más.
 */

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainhand: "Arma",
  offhand: "Off-hand",
  head: "Cabeza",
  armor: "Pecho",
  shoes: "Botas",
  cape: "Capa",
  food: "Comida",
  potion: "Poción",
  mount: "Montura",
};

/** Guarda el nombre buscado en el navegador de quien mira. */
const RECUERDO = "albionpm-mi-nombre";

export function PublicComposition({
  composition,
  slug,
}: {
  composition: SharedComposition;
  slug: string;
}) {
  const [consulta, setConsulta] = useState("");
  const [modo, setModo] = useState<"ficha" | "completa">("completa");
  const compRef = useRef<HTMLDivElement>(null);

  // La única cosa de toda la aplicación que no vive en la base, y por un
  // motivo insalvable: quien mira esta pantalla no tiene cuenta.
  useEffect(() => {
    const guardado = window.localStorage.getItem(`${RECUERDO}:${slug}`);
    if (guardado) setConsulta(guardado);
  }, [slug]);

  const encontrado = useMemo(
    () => buscarJugador(composition, consulta),
    [composition, consulta],
  );

  useEffect(() => {
    if (encontrado) window.localStorage.setItem(`${RECUERDO}:${slug}`, consulta);
  }, [encontrado, consulta, slug]);

  const formats = composition.share_formats ?? {};

  async function descargarPng() {
    if (!compRef.current) return;
    // Import diferido: la librería solo se descarga si alguien de verdad
    // exporta una imagen, no en cada visita.
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(compRef.current, {
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      pixelRatio: 2,
    });
    const enlace = document.createElement("a");
    enlace.download = `${composition.name}.png`;
    enlace.href = dataUrl;
    enlace.click();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{composition.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {formatearEvento(composition.event_at, composition.event_tz)}
        </p>
        {composition.description && (
          <p className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            {composition.description}
          </p>
        )}
      </header>

      {/* Buscador: lo primero, con foco automático. */}
      <div className="print:hidden">
        <label htmlFor="buscar" className="block text-sm font-medium">
          Buscá tu nombre
        </label>
        <input
          id="buscar"
          autoFocus
          value={consulta}
          onChange={(event) => setConsulta(event.target.value)}
          placeholder="Escribí tu nombre de personaje…"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base"
        />
        {consulta.trim() !== "" && !encontrado && (
          <p className="mt-2 text-sm text-muted">
            No encontramos a nadie con ese nombre. Fijate en la composición completa,
            abajo.
          </p>
        )}
      </div>

      {encontrado && (
        <FichaPersonal
          encontrado={encontrado}
          onVerCompleta={() => setModo("completa")}
        />
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setModo(modo === "completa" ? "ficha" : "completa")}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
        >
          {modo === "completa" ? "Ocultar la composición" : "Ver la composición completa"}
        </button>

        {formats.pdf !== false && (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            Guardar como PDF
          </button>
        )}

        {formats.png !== false && (
          <button
            type="button"
            onClick={descargarPng}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            Descargar imagen
          </button>
        )}
      </div>

      <div
        ref={compRef}
        className={
          modo === "completa"
            ? "mt-5 grid gap-4 lg:grid-cols-2 print:grid-cols-2"
            : "mt-5 hidden gap-4 lg:grid-cols-2 print:grid print:grid-cols-2"
        }
      >
        {composition.groups.map((group) => (
          <GrupoCompleto
            key={group.position}
            group={group}
            resaltado={encontrado?.slot}
          />
        ))}
      </div>

      <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted">
        Armado con{" "}
        <a href="/" className="text-accent underline underline-offset-2">
          AlbionPM
        </a>
      </footer>
    </div>
  );
}

// ─── Ficha personal ──────────────────────────────────────────────────────────

function FichaPersonal({
  encontrado,
  onVerCompleta,
}: {
  encontrado: NonNullable<ReturnType<typeof buscarJugador>>;
  onVerCompleta: () => void;
}) {
  const { slot, group, lider, companeros } = encontrado;
  const build = slot.build;

  return (
    <section
      className="mt-4 overflow-hidden rounded-xl border-2"
      style={{ borderColor: build?.color ?? "var(--accent)" }}
    >
      <div
        className="px-4 py-3"
        style={{ background: build?.color ? `${build.color}22` : "var(--surface)" }}
      >
        <p className="text-xl font-semibold">{slot.player_name}</p>
        <p className="mt-0.5 text-sm">
          {group.name ?? `Grupo ${group.position + 1}`}
          {group.guild_name && ` · ${group.guild_name}`}
          {slot.role && ` · ${slot.role.name}`}
        </p>
      </div>

      <div className="space-y-4 p-4">
        {/* Lo primero después de saber que sos vos: a quién seguir. */}
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <span className="text-xs uppercase tracking-wider text-muted">
            Líder de tu grupo
          </span>
          <p className="text-lg font-medium">
            {slot.is_leader ? (
              <>
                Sos vos <span className="text-accent">★</span>
              </>
            ) : (
              (lider?.player_name ?? "Sin líder marcado")
            )}
          </p>
        </div>

        {build ? (
          <div>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted">
              Tu build: {build.name}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EQUIPMENT_SLOTS.map((s) =>
                build.items[s] ? (
                  <div
                    key={s}
                    className="flex items-center gap-2 rounded-lg bg-surface-2 p-2"
                  >
                    <ItemIcon item={build.items[s]} size={40} priority />
                    <span className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wider text-muted">
                        {SLOT_LABELS[s]}
                      </span>
                      {/* El nombre en texto, no solo el ícono: es lo que se
                          copia y se pega en el buscador del mercado. */}
                      <span className="block truncate text-xs">
                        {build.items[s].id.replace(/^T\d_/, "").replace(/_/g, " ")}
                        {build.items[s].ench ? ` .${build.items[s].ench}` : ""}
                      </span>
                    </span>
                  </div>
                ) : null,
              )}
            </div>
            {build.notes && (
              <p className="mt-2 rounded-lg border border-border px-3 py-2 text-sm">
                {build.notes}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Todavía no te asignaron una build. Preguntale a tu líder.
          </p>
        )}

        {slot.notes && (
          <div>
            <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-muted">
              Nota para vos
            </h2>
            <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
              {slot.notes}
            </p>
          </div>
        )}

        {companeros.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">
              Tus {companeros.length} compañeros de grupo
            </summary>
            <ul className="mt-2 space-y-1">
              {companeros.map((c) => (
                <li key={c.position} className="flex items-center gap-2 text-xs">
                  {c.is_leader && <span className="text-accent">★</span>}
                  <span>{c.player_name}</span>
                  <span className="text-muted">{c.role?.name}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <button
          type="button"
          onClick={onVerCompleta}
          className="text-sm text-accent underline underline-offset-4 print:hidden"
        >
          Ver la composición completa
        </button>
      </div>
    </section>
  );
}

// ─── Composición completa ────────────────────────────────────────────────────

function GrupoCompleto({
  group,
  resaltado,
}: {
  group: SharedGroup;
  resaltado: SharedSlot | undefined;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <h2 className="font-medium">{group.name ?? `Grupo ${group.position + 1}`}</h2>
        {group.guild_name && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
            {group.guild_name}
          </span>
        )}
      </header>

      <ul className="divide-y divide-border">
        {group.slots.map((slot) => (
          <li
            key={slot.position}
            className={`flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm ${
              slot === resaltado ? "ring-2 ring-inset ring-accent" : ""
            }`}
            style={slot.build?.color ? { background: `${slot.build.color}22` } : undefined}
          >
            <span className="w-4 text-accent">{slot.is_leader ? "★" : ""}</span>

            <span className="flex gap-0.5">
              {(["mainhand", "offhand", "head", "armor", "shoes"] as const).map((s) =>
                slot.build?.items[s] ? (
                  <ItemIcon key={s} item={slot.build.items[s]} size={24} />
                ) : null,
              )}
            </span>

            <span className="min-w-0 flex-1 truncate font-medium">
              {slot.player_name || <span className="text-muted">Sin asignar</span>}
            </span>

            <span className="truncate text-xs text-muted">
              {slot.role?.name}
              {slot.build && ` · ${slot.build.name}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type SharedGroup = SharedComposition["groups"][number];
