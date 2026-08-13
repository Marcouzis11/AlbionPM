import { ItemIcon } from "@/components/item-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { loadCatalog } from "@/lib/items";
import { readTheme } from "@/lib/theme-server";

/**
 * Portada provisional.
 *
 * Cumple dos funciones mientras se construye el resto: presentar el proyecto,
 * y servir de verificación visual de que la paleta, los temas y el proxy de
 * íconos funcionan de punta a punta.
 */

const DEMO_ITEMS = [
  "T8_MAIN_SWORD",
  "T8_OFF_SHIELD",
  "T8_HEAD_PLATE_SET3",
  "T8_ARMOR_PLATE_SET3",
  "T8_SHOES_PLATE_SET3",
  "T8_2H_HOLYSTAFF",
  "T8_2H_NATURESTAFF",
  "T8_MAIN_FROSTSTAFF",
];

export default async function Home() {
  const [theme, catalog] = await Promise.all([readTheme(), loadCatalog()]);

  const byId = new Map(catalog.map((item) => [item.id, item]));
  const demo = DEMO_ITEMS.map((id) => byId.get(id)).filter((item) => item !== undefined);

  const counts = catalog.reduce<Record<string, number>>((acc, item) => {
    acc[item.slot] = (acc[item.slot] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">AlbionPM</h1>
          <p className="mt-1 text-sm text-muted">
            Gestor de partys para Albion Online
          </p>
        </div>
        <ThemeToggle initial={theme} />
      </header>

      <section className="space-y-4">
        <p className="text-lg leading-relaxed">
          Armá la composición una vez, guardala y compartila con un link. Tu gremio lo
          abre desde el celular, se busca por su nombre y ve{" "}
          <strong className="text-accent">qué build le toca</strong>, en qué grupo va y
          quién es el líder de su grupo de&nbsp;20.
        </p>
        <p className="text-sm text-muted">
          En construcción. Seguí el avance en{" "}
          <a
            href="https://github.com/Marcouzis11/AlbionPM"
            className="text-accent underline underline-offset-4 hover:text-accent-hover"
          >
            GitHub
          </a>
          .
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Catálogo del juego
        </h2>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap gap-2">
            {demo.map((item) => (
              <div
                key={item.id}
                className="flex flex-col items-center gap-1.5 rounded-lg bg-surface-2 p-2"
              >
                <ItemIcon item={item.id} name={item.es} size={52} priority />
                <span className="max-w-[5.5rem] truncate text-[11px] text-muted">
                  {item.es}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-5 border-t border-border pt-4 text-sm text-muted">
            <strong className="text-text">{catalog.length.toLocaleString("es")} items</strong>{" "}
            equipables cargados desde los datos del juego, con sus nombres en español e
            inglés:{" "}
            {Object.entries(counts)
              .sort()
              .map(([slot, count]) => `${count} de ${slot}`)
              .join(", ")}
            .
          </p>
        </div>
      </section>

      <footer className="mt-auto border-t border-border pt-6 text-xs text-muted">
        Proyecto de fans, sin relación con Sandbox Interactive GmbH. Albion Online y sus
        recursos pertenecen a sus respectivos dueños.
      </footer>
    </main>
  );
}
