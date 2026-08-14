/**
 * Descarga los íconos que se usan de verdad y los guarda en `public/icons/`.
 *
 *   npm run icons:plan       ver qué se bajaría y cuánto pesa, sin bajar nada
 *   npm run icons:download   bajarlos
 *
 * ## Qué se baja y por qué
 *
 * No se baja el catálogo entero: con encantamientos serían 7.725 archivos y más
 * de 200 MB, la mayoría de items que nadie equipa. Se baja lo que se usa:
 *
 * - Equipo (arma, off-hand, cabeza, pecho, botas) de **T7 y T8**, con sus cinco
 *   niveles de encantamiento. Es lo que se lleva a ZvZ.
 * - **Todas las monturas**, incluidas las domadas (el garrapresta es
 *   `T5_FARM_COUGAR_GROWN`) y las de evento.
 * - **Todas las capas, comidas y pociones**, de cualquier tier: son baratas en
 *   cantidad de items y se usan en todos los niveles.
 *
 * Queda afuera el equipo de T2 a T6, que no se usa en contenido organizado y es
 * justo lo que hace explotar el tamaño.
 *
 * ## Sobre los encantamientos
 *
 * No todos los items los aceptan, y no hay una lista confiable de cuáles sí.
 * En vez de adivinar, el script pide y descarta lo que devuelva 404. Es
 * autocorrectivo: si un parche agrega encantamientos a algo, aparecen solos al
 * volver a correrlo.
 *
 * ## El servicio falla seguido
 *
 * Medido: cerca del 5% de los pedidos no responde. Por eso hay reintentos y
 * una concurrencia moderada — la idea no es apurar una descarga que se hace una
 * vez por parche, sino no volver a correrla por fallos evitables.
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOGO = resolve(ROOT, "src/data/items.json");
const DESTINO = resolve(ROOT, "public/icons");
const MANIFIESTO = resolve(ROOT, "src/data/icons-locales.json");

/** Tamaño de descarga. Los íconos se muestran entre 22 y 52 px; al doble para
 *  pantallas retina, 128 alcanza y sobra. 217 sería el triple de peso para nada. */
const TAMANO = 128;

const CONCURRENCIA = 6;
const INTENTOS = 3;
const ESPERA_MS = 600;

type Item = {
  id: string;
  slot: string;
  tier: number;
  es: string;
  /** Si admite encantamiento variable. */
  ench?: true;
  /** Encantamiento de fábrica; el id ya lo lleva incluido. */
  fixedEnch?: number;
};

/** Slots de equipo, que solo se bajan en T7 y T8. */
const EQUIPO = new Set(["mainhand", "offhand", "head", "armor", "shoes"]);
const TIER_MINIMO_EQUIPO = 7;

/** Slots que se bajan completos, sin importar el tier. */
const COMPLETOS = new Set(["mount", "cape", "food", "potion"]);

const ENCANTAMIENTOS = [0, 1, 2, 3, 4];

function objetivos(items: Item[]): string[] {
  const ids: string[] = [];

  for (const item of items) {
    const incluir = EQUIPO.has(item.slot)
      ? item.tier >= TIER_MINIMO_EQUIPO
      : COMPLETOS.has(item.slot);

    if (!incluir) continue;

    // Los items con encantamiento de fábrica ya lo llevan en el id (el
    // garrapresta es `..._COUGAR_KEEPER@1`). Agregarles otro nivel produciría
    // `@1@1`, que el servicio rechaza.
    if (item.fixedEnch) {
      ids.push(item.id);
      continue;
    }

    // Y los que no se encantan tienen un solo ícono.
    if (!item.ench) {
      ids.push(item.id);
      continue;
    }

    for (const ench of ENCANTAMIENTOS) {
      ids.push(ench === 0 ? item.id : `${item.id}@${ench}`);
    }
  }

  return ids;
}

async function bajarUno(id: string): Promise<"ok" | "existe" | "sin-icono" | "falla"> {
  const archivo = resolve(DESTINO, `${id}.png`);

  // Reanudable: correrlo dos veces no vuelve a bajar lo que ya está.
  try {
    const info = await stat(archivo);
    if (info.size > 0) return "existe";
  } catch {
    // no existe, seguimos
  }

  const url = `https://render.albiononline.com/v1/item/${encodeURIComponent(id)}.png?size=${TAMANO}&quality=1`;

  for (let intento = 0; intento < INTENTOS; intento++) {
    if (intento > 0) await new Promise((r) => setTimeout(r, ESPERA_MS * intento));

    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(15000) });

      if (respuesta.status === 404) return "sin-icono";
      if (!respuesta.ok) continue;

      const bytes = Buffer.from(await respuesta.arrayBuffer());
      if (bytes.length === 0) continue;

      await writeFile(archivo, bytes);
      return "ok";
    } catch {
      // timeout o error de red: se reintenta
    }
  }

  return "falla";
}

async function main() {
  const simular = process.argv.includes("--dry-run");

  const items: Item[] = JSON.parse(await readFile(CATALOGO, "utf8"));
  const ids = objetivos(items);

  console.log(`Catálogo: ${items.length.toLocaleString("es")} items`);
  console.log(`A descargar: ${ids.length.toLocaleString("es")} archivos a ${TAMANO} px`);

  // Promedio medido sobre una muestra real a 128 px.
  const estimado = (ids.length * 28555) / 1048576;
  console.log(`Peso estimado: ~${estimado.toFixed(0)} MB\n`);

  if (simular) {
    const porSlot = new Map<string, number>();
    for (const item of items) {
      const incluir = EQUIPO.has(item.slot)
        ? item.tier >= TIER_MINIMO_EQUIPO
        : COMPLETOS.has(item.slot);
      if (incluir) porSlot.set(item.slot, (porSlot.get(item.slot) ?? 0) + 1);
    }
    console.log("Items base por slot:");
    for (const [slot, n] of [...porSlot].sort()) {
      console.log(`  ${slot.padEnd(10)} ${n}`);
    }
    console.log("\n(simulación: no se bajó nada)");
    return;
  }

  await mkdir(DESTINO, { recursive: true });

  const conteo = { ok: 0, existe: 0, "sin-icono": 0, falla: 0 };
  const logrados: string[] = [];
  let hechos = 0;

  // Cola simple con concurrencia limitada.
  const cola = [...ids];
  async function trabajador() {
    for (;;) {
      const id = cola.shift();
      if (!id) return;

      const resultado = await bajarUno(id);
      conteo[resultado]++;
      if (resultado === "ok" || resultado === "existe") logrados.push(id);

      if (++hechos % 100 === 0) {
        process.stdout.write(
          `\r  ${hechos}/${ids.length}  ok:${conteo.ok} ya:${conteo.existe} sin-icono:${conteo["sin-icono"]} fallas:${conteo.falla}   `,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));

  // Manifiesto: qué íconos existen en local. Lo usa el componente para decidir
  // si sirve el archivo propio o cae al proxy.
  logrados.sort();
  await writeFile(MANIFIESTO, JSON.stringify(logrados), "utf8");

  console.log(`\n\nDescargados: ${conteo.ok}`);
  console.log(`Ya estaban:  ${conteo.existe}`);
  console.log(`Sin ícono:   ${conteo["sin-icono"]}  (no existen en el servicio)`);
  console.log(`Fallaron:    ${conteo.falla}  ${conteo.falla > 0 ? "← volvé a correrlo, es reanudable" : ""}`);
  console.log(`\nManifiesto: ${MANIFIESTO} (${logrados.length} íconos)`);
}

await main();
