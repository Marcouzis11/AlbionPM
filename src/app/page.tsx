import Link from "next/link";

import { ItemIcon } from "@/components/item-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { loadCatalog } from "@/lib/items";
import { readTheme } from "@/lib/theme-server";
import { bordeDeFila, tinteDeFila } from "@/lib/color";

/**
 * Portada.
 *
 * Lo único que se muestra acá es producto de verdad: los íconos son los del
 * juego servidos por el mismo proxy que usa la aplicación, y la composición
 * del encabezado está armada con las mismas filas de color que ve un jugador.
 * No hay capturas dibujadas con divs ni fotos de banco: para una herramienta
 * de gremio, una foto de gente en una oficina sería exactamente la clase de
 * relleno que le quita credibilidad.
 *
 * Sistema de esquinas (uno solo, en toda la página): contenedores 12 px,
 * controles e íconos 8 px. Nada redondo del todo.
 */

/** La composición del encabezado. Ítems reales, con sus íconos guardados. */
const MUESTRA = [
  {
    rol: "Tanque",
    jugador: "Morvran",
    color: "#4a7f8c",
    items: [
      "T8_MAIN_MACE",
      "T8_OFF_SHIELD",
      "T8_HEAD_PLATE_SET3",
      "T8_ARMOR_PLATE_SET3",
      "T8_SHOES_PLATE_SET3",
    ],
  },
  {
    rol: "Sanador",
    jugador: "Ainhoa",
    color: "#6a7f3a",
    items: [
      "T8_2H_HOLYSTAFF",
      null,
      "T8_HEAD_CLOTH_SET3",
      "T8_ARMOR_CLOTH_SET3",
      "T8_SHOES_CLOTH_SET3",
    ],
  },
  {
    rol: "Daño",
    jugador: "Nicostrato",
    color: "#a95f26",
    items: [
      "T8_2H_INFERNOSTAFF",
      null,
      "T8_HEAD_CLOTH_SET3",
      "T8_ARMOR_CLOTH_SET3",
      "T8_SHOES_CLOTH_SET3",
    ],
  },
  {
    rol: "Control",
    jugador: "Yaguareté",
    color: "#8c4a6b",
    items: [
      "T8_MAIN_FROSTSTAFF",
      "T8_OFF_SHIELD",
      "T8_HEAD_CLOTH_SET3",
      "T8_ARMOR_CLOTH_SET3",
      "T8_SHOES_CLOTH_SET3",
    ],
  },
] as const;

const VITRINA = [
  "T8_MAIN_MACE",
  "T8_2H_HOLYSTAFF",
  "T8_2H_NATURESTAFF",
  "T8_MAIN_FROSTSTAFF",
  "T8_2H_ENIGMATICSTAFF",
  "T8_2H_INFERNOSTAFF",
  "T8_MAIN_ARCANESTAFF",
  "T8_MAIN_SPEAR",
  "T8_OFF_SHIELD",
  "T8_ARMOR_PLATE_SET3",
];

export default async function Home() {
  const [theme, catalog] = await Promise.all([readTheme(), loadCatalog()]);

  const byId = new Map(catalog.map((item) => [item.id, item]));
  const vitrina = VITRINA.map((id) => byId.get(id)).filter((item) => item !== undefined);

  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-fg"
      >
        Saltar al contenido
      </a>

      <nav
        aria-label="Principal"
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5 sm:px-8"
      >
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Albion<span className="text-accent">PM</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle initial={theme} />
          <Link
            href="/entrar"
            className="flex h-10 items-center rounded-lg px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text active:translate-y-px"
          >
            Entrar
          </Link>
          <Link
            href="/registro"
            className="flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover active:translate-y-px"
          >
            Crear cuenta
          </Link>
        </div>
      </nav>

      <main id="contenido" className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* Encabezado partido: el mensaje a la izquierda, el producto a la
            derecha. Centrarlo habría dejado la mitad de la pantalla vacía
            justo donde hay algo real para mostrar. */}
        <section className="grid items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:py-20">
          <div>
            <h1 className="text-pretty text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              Armala una vez.
              <br />
              Que la vea todo el gremio.
            </h1>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">
              Guardás la composición, compartís un link, y cada jugador se busca por su
              nombre y ve su build.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/registro"
                className="flex h-12 items-center rounded-lg bg-accent px-6 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover active:translate-y-px"
              >
                Crear cuenta
              </Link>
              <Link
                href="/entrar"
                className="flex h-12 items-center rounded-lg border border-border px-6 text-sm transition-colors hover:bg-surface-2 active:translate-y-px"
              >
                Entrar
              </Link>
            </div>
          </div>

          <ComposicionDeMuestra />
        </section>

        {/* Una sola afirmación, ancha y sola. Partirla en tres tarjetitas
            habría convertido el problema en decoración. */}
        <section className="border-t border-border py-14 lg:py-20">
          <p className="max-w-[34ch] text-balance text-2xl font-medium leading-snug tracking-tight md:text-3xl">
            La composición ya existe. El problema es que vive en una captura de pantalla
            perdida en el Discord.
          </p>
          <p className="mt-5 max-w-[62ch] leading-relaxed text-muted">
            Alguien se sienta a decidir quién lleva qué, y ese trabajo se pierde apenas
            termina la CTA. La próxima vez se hace de nuevo. Y el que solo quiere jugar
            aparece sin saber qué armar, o directamente con la build equivocada.
          </p>
        </section>

        {/* Dos columnas de peso distinto: quien organiza tiene diez cosas para
            hacer, el jugador tiene una. Darles el mismo ancho habría mentido
            sobre eso. */}
        <section className="grid gap-8 border-t border-border py-14 lg:grid-cols-[1.35fr_1fr] lg:gap-12 lg:py-20">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Para quien organiza</h2>
            <ul className="mt-6 divide-y divide-border">
              <Punto titulo="Contenidos y composiciones">
                Gankeo, CTA, Castillo, los que uses. Adentro de cada uno, sus
                composiciones de uno o varios grupos de 20.
              </Punto>
              <Punto titulo="Biblioteca de builds">
                Con carpetas, tags y un color por build que pinta su fila en cualquier
                composición donde aparezca.
              </Punto>
              <Punto titulo="Plantillas y duplicados">
                Duplicar, duplicar sin builds, copiar a otro contenido, o vaciar dejando
                solo la estructura.
              </Punto>
              <Punto titulo="Disarray e historial">
                El disarray estimado contando solo a la gente confirmada, y todo lo que
                armaste con su fecha.
              </Punto>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-surface-2/60 p-6">
            <h2 className="text-2xl font-semibold tracking-tight">Para el jugador</h2>
            <p className="mt-4 leading-relaxed text-muted">
              Abre el link, escribe su nombre y ve su build completa, su rol, su grupo y
              quién lo lidera. Sin registrarse y sin instalar nada.
            </p>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {vitrina.slice(0, 6).map((item) => (
                <span
                  key={item.id}
                  className="rounded-lg bg-surface p-1.5 ring-1 ring-border"
                >
                  <ItemIcon item={item.id} name={item.es} size={40} />
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Tres pasos numerados porque son una secuencia de verdad: sin el
            link no hay nombre que buscar, y sin buscarse no hay build. */}
        <section className="border-t border-border py-14 lg:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            Lo que hace el jugador
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6">
            <Paso numero={1} titulo="Abre el link">
              Le llega por Discord o por WhatsApp. No hay cuenta que crear ni aplicación
              que bajar.
            </Paso>
            <Paso numero={2} titulo="Escribe su nombre">
              El mismo que usa adentro del juego. La búsqueda no distingue mayúsculas.
            </Paso>
            <Paso numero={3} titulo="Ve qué le toca">
              Su equipo pieza por pieza, en qué grupo va y a quién tiene que seguir.
            </Paso>
          </ol>
        </section>

        <section className="border-t border-border py-14 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">
                {catalog.length.toLocaleString("es-AR")}
              </p>
              <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted">
                items equipables cargados desde los datos del juego, con sus nombres en
                español y en inglés. El catálogo se actualiza solo.
              </p>
            </div>

            <div
              aria-hidden
              className="flex flex-wrap gap-1.5 opacity-90"
            >
              {vitrina.map((item) => (
                <ItemIcon key={item.id} item={item.id} name={item.es} size={38} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-5 pb-12 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          <p className="max-w-[58ch]">
            Proyecto de fans, sin relación con Sandbox Interactive GmbH. Albion Online y
            sus recursos pertenecen a sus respectivos dueños.
          </p>
          <a
            href="https://github.com/Marcouzis11/AlbionPM"
            className="rounded-lg text-accent underline underline-offset-4 transition-colors hover:text-accent-hover"
          >
            Código en GitHub
          </a>
        </div>
      </footer>
    </>
  );
}

/**
 * La composición de muestra.
 *
 * Es la interfaz de verdad en chico, no un dibujo: las filas se pintan con el
 * color de la build igual que en la aplicación, que es justamente lo que hay
 * que entender de un vistazo.
 */
function ComposicionDeMuestra() {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-[0_18px_40px_-24px_rgb(34_28_20_/_0.45)] sm:p-4">
      <div className="flex items-center gap-2 border-b border-border px-1 pb-3">
        <span className="size-2 rounded-lg bg-accent" aria-hidden />
        <p className="text-sm font-medium">CTA del sábado</p>
        <p className="ml-auto text-xs tabular-nums text-muted">Grupo 1 de 3</p>
      </div>

      <ul className="aparece-escalonado mt-3 space-y-1.5">
        {MUESTRA.map((fila) => (
          <li
            key={fila.jugador}
            className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
            style={{ background: tinteDeFila(fila.color), borderColor: bordeDeFila(fila.color) }}
          >
            <span className="flex shrink-0 gap-1">
              {fila.items.map((id, indice) =>
                id ? (
                  <ItemIcon key={id + indice} item={id} size={30} priority />
                ) : (
                  <span
                    key={`vacio-${indice}`}
                    className="size-[30px] shrink-0 rounded-lg border border-dashed border-border"
                  />
                ),
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{fila.jugador}</span>
              <span className="block truncate text-xs text-muted">{fila.rol}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 px-1 text-xs text-muted">
        Cada color es una build de tu biblioteca.
      </p>
    </div>
  );
}

function Punto({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <li className="py-4 first:pt-0">
      <p className="font-medium">{titulo}</p>
      <p className="mt-1 max-w-[58ch] text-sm leading-relaxed text-muted">{children}</p>
    </li>
  );
}

function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className="border-t-2 border-accent/30 pt-4">
      <p className="text-sm font-medium tabular-nums text-accent">{numero}</p>
      <p className="mt-2 font-medium">{titulo}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </li>
  );
}
