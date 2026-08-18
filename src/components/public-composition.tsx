"use client";

import { Crown, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ItemIcon } from "@/components/item-icon";
import { DISPOSICION_EQUIPO } from "@/lib/builds-shared";
import { EQUIPMENT_SLOTS, SLOT_LABELS } from "@/lib/items";
import {
  buscarJugador,
  formatearEvento,
  type SharedComposition,
  type SharedSlot,
} from "@/lib/shared-composition";
import { textoSobre } from "@/lib/color";

/**
 * Vista pública de una composición. Es la pantalla que justifica el proyecto.
 *
 * Todo el trabajo del líder existe para que alguien abra esto desde el celular,
 * con poca señal, cinco minutos antes de la CTA, y sepa en treinta segundos qué
 * hacer. Por eso la composición entera llega ya renderizada desde el servidor y
 * el buscador filtra sobre datos que ya están en la página: ni una petición más.
 */

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

      {/* Buscador: lo primero, con foco automático y con el peso visual que
          corresponde. Es la única cosa que esta pantalla le pide al jugador,
          así que no puede pesar lo mismo que el resto. */}
      <div className="print:hidden">
        <label htmlFor="buscar" className="block text-base font-medium">
          Buscá tu nombre
        </label>
        <input
          id="buscar"
          autoFocus
          value={consulta}
          onChange={(event) => setConsulta(event.target.value)}
          placeholder="Tu nombre de personaje"
          aria-describedby="ayuda-buscar"
          className="mt-2 h-14 w-full rounded-xl border border-border bg-surface px-4 text-lg transition-colors focus:border-accent"
        />
        <p id="ayuda-buscar" className="mt-2 text-sm text-muted">
          {consulta.trim() === "" ? (
            "Escribilo como lo tenés en el juego. No importan las mayúsculas."
          ) : !encontrado ? (
            <span className="text-danger">
              No hay nadie con ese nombre en esta composición. Fijate si lo escribiste
              distinto, o buscate en la lista completa de abajo.
            </span>
          ) : (
            "Listo, sos vos."
          )}
        </p>
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
          className="flex h-11 items-center rounded-lg border border-border px-4 text-sm transition-colors hover:bg-surface-2 active:translate-y-px"
        >
          {modo === "completa" ? "Ocultar la composición" : "Ver la composición completa"}
        </button>

        {formats.pdf !== false && (
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-11 items-center rounded-lg border border-border px-4 text-sm transition-colors hover:bg-surface-2 active:translate-y-px"
          >
            Guardar como PDF
          </button>
        )}

        {formats.png !== false && (
          <button
            type="button"
            onClick={descargarPng}
            className="flex h-11 items-center rounded-lg border border-border px-4 text-sm transition-colors hover:bg-surface-2 active:translate-y-px"
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
        style={
          build?.color
            ? { background: build.color, color: textoSobre(build.color) }
            : { background: "var(--surface)" }
        }
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
          <span className="text-xs font-medium text-muted">Líder de tu grupo</span>
          <p className="flex items-center gap-1.5 text-lg font-medium">
            <Crown
              size={17}
              aria-hidden
              className="shrink-0 text-accent"
              fill="currentColor"
              stroke="#101013"
              strokeWidth={1.5}
            />
            {slot.is_leader ? "Sos vos" : (lider?.player_name ?? "Sin líder marcado")}
          </p>
        </div>

        {build ? (
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted">Tu build: {build.name}</h2>
            {/* Acomodado como el panel de personaje del juego, igual que en la
                aplicación: quien juega reconoce la pieza por su lugar. El
                nombre en texto se queda debajo, porque es lo que se copia y se
                pega en el buscador del mercado. */}
            <div className="flex flex-wrap items-start gap-4">
              <div className="grid w-44 shrink-0 grid-cols-3">
                {DISPOSICION_EQUIPO.flat().map((slot, indice) =>
                  slot === null ? (
                    <span key={`hueco-${indice}`} aria-hidden />
                  ) : build.items[slot] ? (
                    <ItemIcon
                      key={slot}
                      item={build.items[slot]}
                      name={SLOT_LABELS[slot]}
                      size={96}
                      priority
                      className="h-auto w-full"
                    />
                  ) : (
                    <span
                      key={slot}
                      className="m-1 flex aspect-square items-center justify-center rounded border border-dashed border-border text-[9px] font-semibold leading-none text-muted"
                    >
                      {SLOT_LABELS[slot].slice(0, 4)}
                    </span>
                  ),
                )}
              </div>

              <ul className="min-w-0 flex-1 space-y-0.5 text-xs">
                {DISPOSICION_EQUIPO.flat().map((slot) =>
                  slot && build.items[slot] ? (
                    <li key={slot} className="flex gap-1.5">
                      <span className="w-16 shrink-0 text-muted">{SLOT_LABELS[slot]}</span>
                      <span className="min-w-0 flex-1">
                        {build.items[slot].id.replace(/^T\d_/, "").replace(/_/g, " ")}
                        {build.items[slot].ench ? ` .${build.items[slot].ench}` : ""}
                      </span>
                    </li>
                  ) : null,
                )}
              </ul>
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
            <h2 className="mb-1 text-sm font-medium text-muted">Nota para vos</h2>
            <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
              {slot.notes}
            </p>
          </div>
        )}

        {companeros.length > 0 && (
          <details className="text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center text-muted">
              Tus {companeros.length} compañeros de grupo
            </summary>
            <ul className="mt-2 space-y-1">
              {companeros.map((c) => (
                <li key={c.position} className="flex items-center gap-2 text-xs">
                  {c.is_leader && (
                    <Crown
                      size={12}
                      aria-label="Líder"
                      className="shrink-0 text-accent"
                      fill="currentColor"
                      stroke="#101013"
                      strokeWidth={1.5}
                    />
                  )}
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
          className="flex min-h-11 items-center text-sm text-accent underline underline-offset-4 print:hidden"
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
  const confirmados = group.slots.filter(
    (s) => (s.player_name ?? "").trim() !== "",
  ).length;

  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <h2 className="font-medium">{group.name ?? `Grupo ${group.position + 1}`}</h2>
        {group.guild_name && (
          <span className="rounded-lg bg-surface-2 px-2 py-0.5 text-xs">
            {group.guild_name}
          </span>
        )}
        <span
          className="ml-auto flex items-center gap-1 text-xs tabular-nums text-muted"
          title={`${confirmados} de ${group.slots.length} lugares con nombre`}
        >
          <User size={13} aria-hidden />
          {confirmados}/{group.slots.length}
        </span>
      </header>

      <ul className="divide-y divide-border">
        {group.slots.map((slot) => (
          <li
            key={slot.position}
            className={`flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm ${
              slot === resaltado ? "ring-2 ring-inset ring-accent" : ""
            }`}
            style={
              slot.build?.color
                ? {
                    background: slot.build.color,
                    color: textoSobre(slot.build.color),
                  }
                : undefined
            }
          >
            <span className="flex w-4 shrink-0 justify-center">
              {slot.is_leader && (
                <Crown
                  size={13}
                  aria-label="Líder del grupo"
                  fill="currentColor"
                  stroke="#101013"
                  strokeWidth={1.5}
                />
              )}
            </span>

            {/* TODAS las piezas, no solo las cinco principales. Un jugador que
                abre esto quiere saber qué se pone, y la capa, la comida, la
                poción y la montura son parte de eso: son justo las que uno se
                olvida de llevar. Se muestran solo las que la build tiene, así
                una build de cinco piezas no arrastra cuatro huecos. */}
            <span className="flex shrink-0 flex-wrap">
              {EQUIPMENT_SLOTS.map((pieza) =>
                slot.build?.items[pieza] ? (
                  <ItemIcon
                    key={pieza}
                    item={slot.build.items[pieza]}
                    name={SLOT_LABELS[pieza]}
                    size={64}
                    className="size-8 print:size-6"
                  />
                ) : null,
              )}
            </span>

            <span className="min-w-0 flex-1 truncate font-medium">
              {slot.player_name || (
                <span className={slot.build?.color ? "opacity-70" : "text-muted"}>
                  Sin asignar
                </span>
              )}
            </span>

            <span
              className={`truncate text-xs ${
                slot.build?.color ? "font-medium opacity-85" : "text-muted"
              }`}
            >
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
