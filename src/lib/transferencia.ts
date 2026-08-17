import { z } from "zod";

/**
 * El formato de los archivos que se exportan e importan.
 *
 * Es un contrato con el afuera: una vez que alguien guardó un archivo, ese
 * archivo tiene que seguir abriéndose dentro de seis meses aunque la base haya
 * cambiado. De ahí tres decisiones:
 *
 * - **Lleva `version`.** El día que el formato cambie, un archivo viejo se va a
 *   poder distinguir y convertir en vez de fallar con un error ilegible.
 * - **No hay ni un identificador de la base.** Los `uuid` no significan nada en
 *   otra cuenta ni en otra instalación. Las builds se referencian con una marca
 *   interna del archivo (`ref`), que solo tiene que ser única adentro de él.
 * - **Los roles viajan por nombre.** Un rol es de un juego y puede ser de otro
 *   dueño; al importar se busca por nombre y, si no aparece, el lugar queda sin
 *   rol. Preferible a inventar roles ajenos en la biblioteca de quien importa.
 *
 * Todo lo que entra se valida con Zod ANTES de tocar la base. Un archivo lo
 * edita cualquiera con un editor de texto, así que acá no se confía en nada.
 */

export const VERSION = 1;

const itemSchema = z.object({
  id: z.string().regex(/^T\d_[A-Z0-9_]+$/, "Identificador de item inválido"),
  ench: z.number().int().min(0).max(4).optional(),
  quality: z.number().int().min(1).max(5).optional(),
});

const itemsSchema = z.partialRecord(
  z.enum([
    "mainhand",
    "offhand",
    "head",
    "armor",
    "shoes",
    "cape",
    "food",
    "potion",
    "mount",
  ]),
  itemSchema,
);

const hexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "El color tiene que ser un hexadecimal tipo #RRGGBB");

export const buildExportadaSchema = z.object({
  /** Única dentro del archivo. Es lo que usan los lugares para apuntarle. */
  ref: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  /**
   * El color que se VE, no el que está guardado.
   *
   * Una build sin color propio que hereda el de su carpeta se exporta con ese
   * color ya resuelto. Del otro lado las carpetas son otras y todo cae en
   * «Importados», así que una herencia no tendría de dónde colgarse: llegaría
   * gris y quien la recibe vería algo distinto de lo que le mostraron.
   */
  color: hexSchema.nullable().default(null),
  tags: z.array(z.string().max(40)).max(20).default([]),
  items: itemsSchema.default({}),
  notes: z.string().max(2000).nullable().default(null),
  /** Nombre del rol, no su identificador. */
  rol: z.string().max(60).nullable().default(null),
  /** La carpeta de donde salió, para reconstruirla al importar. */
  carpeta: z.string().max(120).nullable().default(null),
});

const lugarSchema = z.object({
  position: z.number().int().min(0).max(19),
  player_name: z.string().max(60).nullable().default(null),
  is_leader: z.boolean().default(false),
  notes: z.string().max(500).nullable().default(null),
  rol: z.string().max(60).nullable().default(null),
  /** Apunta a una `ref` del arreglo `builds`. */
  build: z.string().max(64).nullable().default(null),
});

const grupoSchema = z.object({
  position: z.number().int().min(0).max(50),
  name: z.string().max(60).nullable().default(null),
  guild_name: z.string().max(60).nullable().default(null),
  lugares: z.array(lugarSchema).max(20).default([]),
});

/** Un archivo con una composición y las builds que usa. */
export const archivoComposicionSchema = z.object({
  albionpm: z.literal(VERSION),
  tipo: z.literal("composicion"),
  exportado: z.string(),
  composicion: z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullable().default(null),
    event_tz: z.string().max(60).default("America/Argentina/Buenos_Aires"),
    grupos: z.array(grupoSchema).max(50).default([]),
  }),
  builds: z.array(buildExportadaSchema).max(500).default([]),
});

/** Un archivo con builds sueltas. */
export const archivoBuildsSchema = z.object({
  albionpm: z.literal(VERSION),
  tipo: z.literal("builds"),
  exportado: z.string(),
  /** De dónde salieron, para nombrar la subcarpeta al importar. */
  origen: z.string().max(120).nullable().default(null),
  builds: z.array(buildExportadaSchema).max(500).default([]),
});

export const archivoSchema = z.discriminatedUnion("tipo", [
  archivoComposicionSchema,
  archivoBuildsSchema,
]);

export type BuildExportada = z.infer<typeof buildExportadaSchema>;
export type ArchivoComposicion = z.infer<typeof archivoComposicionSchema>;
export type ArchivoBuilds = z.infer<typeof archivoBuildsSchema>;
export type Archivo = z.infer<typeof archivoSchema>;

/** Donde cae todo lo que se importa. */
export const CARPETA_IMPORTADOS = "Importados";

/**
 * Un nombre de archivo que se pueda escribir en cualquier sistema.
 *
 * Windows rechaza `\\ / : * ? " < > |`, y un nombre con acentos viaja mal por
 * correo y por Discord. Se limpia acá y no en cada botón para que los dos tipos
 * de archivo salgan iguales.
 */
export function nombreDeArchivo(base: string): string {
  const limpio = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${limpio || "albionpm"}.albionpm.json`;
}
