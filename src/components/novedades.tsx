"use client";

import { useEffect } from "react";

import { marcarLeidas } from "@/components/novedades-leidas";
import { NOVEDADES } from "@/lib/novedades";

/**
 * Las novedades del sistema.
 *
 * Agrupadas por día y de lo más nuevo a lo más viejo, que es el orden en que se
 * leen: quien entra quiere saber qué cambió desde la última vez, no la historia
 * del proyecto.
 *
 * Cada entrada dice DÓNDE está lo que cuenta. Sin eso, «ahora podés pintar una
 * carpeta entera» obliga a salir a buscar la pantalla.
 */
export function Novedades() {
  // Abrir esta pantalla es haberlas leído. Es un efecto legítimo: sincroniza
  // el navegador con algo que pasó, no calcula nada para pintar.
  useEffect(() => {
    marcarLeidas();
  }, []);

  const porFecha = new Map<string, typeof NOVEDADES>();
  for (const novedad of NOVEDADES) {
    porFecha.set(novedad.fecha, [...(porFecha.get(novedad.fecha) ?? []), novedad]);
  }

  return (
    <div className="con-barra h-full overflow-y-auto pr-3">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Novedades</h1>
        <p className="mt-1 max-w-[62ch] text-sm text-muted">
          Lo que se puede hacer ahora y antes no. Los arreglos no se anotan acá:
          si algo andaba mal y se corrigió, no hay nada nuevo que aprender.
        </p>

        <div className="mt-6 space-y-8 pb-10">
          {[...porFecha.entries()].map(([fecha, delDia]) => (
            <section key={fecha}>
              <h2 className="text-sm font-medium text-muted">
                <time dateTime={fecha}>{formatearFecha(fecha)}</time>
              </h2>

              <ul className="mt-3 space-y-3">
                {delDia.map((novedad) => (
                  <li
                    key={novedad.titulo}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{novedad.titulo}</h3>
                      <span className="rounded-lg bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                        {novedad.donde}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted">
                      {novedad.detalle}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatearFecha(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(ano, mes - 1, dia));
  } catch {
    return iso;
  }
}
