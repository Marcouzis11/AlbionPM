/**
 * Genera el catálogo de items equipables a partir de los dumps del juego.
 *
 *   npm run build:items
 *
 * Descarga `items.json` de ao-bin-dumps (~24 MB, 12.000 entradas), se queda
 * solo con lo que una persona puede llevar puesto (~1.700 entradas) y escribe
 * `src/data/items.json`.
 *
 * El resultado se versiona en el repositorio a propósito: el catálogo solo
 * cambia cuando sale un parche, así que pedirlo en tiempo de ejecución sería
 * pagar 24 MB para obtener siempre lo mismo.
 *
 * Volvé a correrlo después de cada parche de Albion Online.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";

const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/data/items.json",
);

/**
 * Primer segmento del `UniqueName` (después del tier) → slot de equipo.
 * Todo token que no esté acá se descarta: recursos, libros, muebles,
 * bolsas de loot, artefactos de crafteo y demás cosas que no se equipan.
 */
const SLOT_BY_TOKEN: Record<string, EquipmentSlot> = {
  MAIN: "mainhand", // armas de una mano
  "2H": "mainhand", // armas a dos manos
  OFF: "offhand",
  HEAD: "head",
  ARMOR: "armor",
  SHOES: "shoes",
  CAPE: "cape",
  CAPEITEM: "cape",
  MEAL: "food",
  POTION: "potion",
  MOUNT: "mount",
};

export type EquipmentSlot =
  | "mainhand"
  | "offhand"
  | "head"
  | "armor"
  | "shoes"
  | "cape"
  | "food"
  | "potion"
  | "mount";

export type CatalogItem = {
  /** `UniqueName` del juego, sin encantamiento. Ej: `T8_MAIN_SWORD` */
  id: string;
  /** Nombre en inglés */
  en: string;
  /** Nombre en español */
  es: string;
  slot: EquipmentSlot;
  /** 1 a 8 */
  tier: number;
  /** Solo en `mainhand`: si ocupa las dos manos y bloquea el off-hand */
  twoHanded?: true;
};

type RawItem = {
  UniqueName?: string;
  LocalizedNames?: Record<string, string> | null;
};

async function main() {
  console.log(`Descargando ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`No se pudo descargar el catálogo: HTTP ${response.status}`);
  }

  const raw: RawItem[] = await response.json();
  console.log(`  ${raw.length.toLocaleString("es")} entradas en el origen`);

  const items: CatalogItem[] = [];

  for (const entry of raw) {
    const uniqueName = entry.UniqueName;
    if (!uniqueName) continue;

    // Las variantes encantadas (`@1`…`@4`) son el mismo item: el encantamiento
    // se guarda aparte en la build, no como items distintos.
    if (uniqueName.includes("@")) continue;

    const match = /^T(\d)_(.+)$/.exec(uniqueName);
    if (!match) continue;

    const tier = Number(match[1]);
    const token = match[2].split("_")[0];
    const slot = SLOT_BY_TOKEN[token];
    if (!slot) continue;

    // Sin nombre en inglés no hay nada que mostrar ni que buscar.
    const en = entry.LocalizedNames?.["EN-US"];
    if (!en) continue;

    const item: CatalogItem = {
      id: uniqueName,
      en,
      // Bastantes items no están traducidos al español; el inglés es el
      // respaldo razonable, y es lo que la gente ve en el juego igual.
      es: entry.LocalizedNames?.["ES-ES"] ?? en,
      slot,
      tier,
    };

    if (token === "2H") item.twoHanded = true;

    items.push(item);
  }

  items.sort(
    (a, b) =>
      a.slot.localeCompare(b.slot) || a.tier - b.tier || a.en.localeCompare(b.en),
  );

  const bySlot = new Map<EquipmentSlot, number>();
  for (const item of items) {
    bySlot.set(item.slot, (bySlot.get(item.slot) ?? 0) + 1);
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(items), "utf8");

  console.log(`\n${items.length.toLocaleString("es")} items equipables:`);
  for (const [slot, count] of [...bySlot].sort()) {
    console.log(`  ${slot.padEnd(10)} ${count}`);
  }
  console.log(`\nEscrito en ${OUT_PATH}`);
}

await main();
