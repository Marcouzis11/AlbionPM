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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Catálogo completo, para el servidor. */
const OUT_PATH = resolve(ROOT, "src/data/items.json");

/**
 * Además se escribe un archivo por slot en `public/items/`.
 *
 * El selector de items corre en el navegador y necesita los datos ahí, pero
 * mandarle el catálogo entero serían 217 KB para elegir un arma. Partido por
 * slot, el más grande son ~100 KB y solo se descarga el del slot que se está
 * editando. Al vivir en `public/`, lo sirve el CDN directo: cero funciones
 * ejecutadas y cero costo.
 */
const OUT_DIR_PUBLIC = resolve(ROOT, "public/items");

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

/**
 * Animales de granja que NO son monturas.
 *
 * Las monturas domadas viven bajo `FARM_..._GROWN` y no bajo `MOUNT_`, así que
 * hay que incluir esa familia — es donde está el garrapresta
 * (`T5_FARM_COUGAR_GROWN`), entre otras. Pero ahí también están el ganado y las
 * aves de corral, que no se montan.
 */
const NO_SON_MONTURAS = new Set([
  "CHICKEN",
  "GOAT",
  "GOOSE",
  "SHEEP",
  "PIG",
  "COW",
]);

/**
 * Cosas que técnicamente ocupan un slot de equipo pero que nadie lleva a una
 * party, y que solo ensucian el buscador cuando estás armando una comp.
 *
 * - `_TOOL_`: hachas de leñador, picos, hoces, cuchillos de despellejar y las
 *   cañas de pescar, que son `2H_TOOL_FISHINGROD`.
 * - `_GATHERER_`: los atuendos de profesión (minero, pescador, leñador,
 *   cosechador), de cualquier tier.
 */
const EXCLUIR = /_TOOL_|_GATHERER_/;

/**
 * Tier mínimo. Por debajo de T4 no se usa nada en contenido organizado, y son
 * cientos de entradas que solo estorban al buscar.
 *
 * Las monturas de evento (`UNIQUE_MOUNT_`) llevan tier 0 porque su nombre no
 * lo indica; se dejan pasar aparte.
 */
const TIER_MINIMO = 4;

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
  /**
   * Encantamiento que el item trae de fábrica y no se puede cambiar.
   *
   * Hay items que SOLO existen encantados: el garrapresta es
   * `T5_MOUNT_COUGAR_KEEPER@1` y no hay un `@0` ni un `@2`. Para esos, el
   * nivel es parte de su identidad —se muestran como «5.1»— y no se ofrece
   * subirlo ni bajarlo.
   */
  fixedEnch?: number;
  /**
   * Si admite encantamiento.
   *
   * No se adivina por slot: se toma del propio volcado del juego, que incluye
   * la variante `@1` como entrada aparte para todo lo que se puede encantar.
   * Las monturas y las comidas no lo admiten; las armas, armaduras, capas y
   * pociones sí.
   */
  ench?: true;
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

  // Todo lo que se puede encantar aparece en el volcado también con `@1`.
  // Es la fuente autoritativa: cualquier otra regla sería una suposición.
  const encantables = new Set<string>();
  const todos = new Set<string>();

  for (const entry of raw) {
    const nombre = entry.UniqueName ?? "";
    todos.add(nombre);
    const match = /^(.+)@1$/.exec(nombre);
    if (match) encantables.add(match[1]);
  }

  const items: CatalogItem[] = [];
  let descartados = 0;

  for (const entry of raw) {
    const uniqueName = entry.UniqueName;
    if (!uniqueName) continue;

    // Las variantes encantadas suelen ser el mismo item —el encantamiento se
    // guarda aparte en la build—, PERO hay items que solo existen encantados:
    // el garrapresta es `T5_MOUNT_COUGAR_KEEPER@1` y no hay una versión sin
    // encantar. Descartar toda entrada con `@` los perdía a todos.
    let fixedEnch = 0;
    let nombreBase = uniqueName;

    const conArroba = /^(.+)@(\d)$/.exec(uniqueName);
    if (conArroba) {
      // Si el item también existe sin encantar, esto es una variante y se
      // descarta. Si no existe, el encantamiento es parte de su identidad.
      if (todos.has(conArroba[1])) continue;
      nombreBase = conArroba[1];
      fixedEnch = Number(conArroba[2]);
    }

    let tier: number;
    let slot: EquipmentSlot | undefined;

    const conTier = /^T(\d)_(.+)$/.exec(nombreBase);

    if (conTier) {
      tier = Number(conTier[1]);
      const resto = conTier[2];
      const token = resto.split("_")[0];

      if (token === "FARM" && resto.endsWith("_GROWN")) {
        // Monturas domadas: `T5_FARM_COUGAR_GROWN` es el garrapresta.
        const animal = resto.replace(/^FARM_/, "").replace(/_GROWN$/, "").split("_")[0];
        if (!NO_SON_MONTURAS.has(animal)) slot = "mount";
      } else {
        slot = SLOT_BY_TOKEN[token];
      }
    } else if (nombreBase.startsWith("UNIQUE_MOUNT_")) {
      // Monturas de evento y de recompensa. No tienen tier en el nombre;
      // se les asigna 0 para que queden agrupadas aparte al ordenar.
      tier = 0;
      slot = "mount";
    } else {
      continue;
    }

    if (!slot) continue;

    // Herramientas, cañas de pescar y ropa de profesión.
    if (EXCLUIR.test(nombreBase)) {
      descartados++;
      continue;
    }

    // Tier bajo. Las monturas de evento van con tier 0 y quedan exentas.
    if (tier > 0 && tier < TIER_MINIMO) {
      descartados++;
      continue;
    }

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

    if (conTier && conTier[2].startsWith("2H_")) item.twoHanded = true;
    if (fixedEnch > 0) item.fixedEnch = fixedEnch;
    else if (encantables.has(uniqueName)) item.ench = true;

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

  await mkdir(OUT_DIR_PUBLIC, { recursive: true });
  for (const slot of new Set(items.map((item) => item.slot))) {
    const subset = items
      .filter((item) => item.slot === slot)
      // El slot ya está en el nombre del archivo: repetirlo en cada entrada
      // serían kilobytes de la misma palabra.
      .map(({ slot: _slot, ...rest }) => rest);

    await writeFile(
      resolve(OUT_DIR_PUBLIC, `${slot}.json`),
      JSON.stringify(subset),
      "utf8",
    );
  }

  console.log(`\n${descartados.toLocaleString("es")} descartados (herramientas, ropa de profesión, tier bajo)`);
  console.log(`\n${items.length.toLocaleString("es")} items equipables:`);
  for (const [slot, count] of [...bySlot].sort()) {
    console.log(`  ${slot.padEnd(10)} ${count}`);
  }
  console.log(`\nEscrito en ${OUT_PATH}`);
  console.log(`Y un archivo por slot en ${OUT_DIR_PUBLIC}`);
}

await main();
