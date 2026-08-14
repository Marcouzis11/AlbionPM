/**
 * Utilidades de color para el selector de builds.
 *
 * La distancia entre colores se mide en OKLab y no en RGB. En RGB, dos colores
 * numéricamente lejanos pueden verse idénticos, y dos cercanos, muy distintos:
 * el espacio no se corresponde con lo que percibe el ojo. OKLab sí, y es lo
 * que permite avisar "este color es casi igual a otro que ya usás" sin dar
 * falsos avisos ni dejar pasar los parecidos de verdad.
 */

export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

const HEX = /^#?([0-9a-f]{6})$/i;

/** Acepta con o sin `#`, en mayúsculas o minúsculas. */
export function parseHex(input: string): string | null {
  const match = HEX.exec(input.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

export function hexToRgb(hex: string): Rgb {
  const clean = parseHex(hex) ?? "#000000";
  return {
    r: parseInt(clean.slice(1, 3), 16),
    g: parseInt(clean.slice(3, 5), 16),
    b: parseInt(clean.slice(5, 7), 16),
  };
}

export function hexToHsv(hex: string): Hsv {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

/** sRGB → OKLab. Fórmula de Björn Ottosson. */
function hexToOklab(hex: string): { L: number; a: number; b: number } {
  const { r, g, b } = hexToRgb(hex);

  const lin = (c: number) => {
    const n = c / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };

  const R = lin(r);
  const G = lin(g);
  const B = lin(b);

  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** Distancia perceptual. Por debajo de ~0.08 dos colores cuestan de distinguir. */
export function colorDistance(hexA: string, hexB: string): number {
  const a = hexToOklab(hexA);
  const b = hexToOklab(hexB);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

/** Umbral de "demasiado parecido", calibrado a ojo sobre la paleta del proyecto. */
export const SIMILAR_THRESHOLD = 0.08;

/**
 * Diferencia de tono en grados, por el camino más corto.
 *
 * El panel de saturación/brillo representa un solo tono a la vez, así que un
 * color de otro tono no tiene posición real ahí. Esto decide cuáles marcar.
 */
export function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Tolerancia para mostrar un color usado sobre el panel de saturación/brillo. */
export const HUE_TOLERANCE = 15;

/**
 * Los colores que distinguen un contenido de otro.
 *
 * Son vivos a propósito. La versión anterior los bajaba de saturación para que
 * no se despegaran del carbón cálido del tema oscuro, y el resultado fue el
 * contrario del buscado: pastillas apagadas que se fundían con el fondo justo
 * en la pantalla donde el color es lo único que distingue una carpeta de otra
 * de un vistazo.
 *
 * Dos reglas se mantienen de la lista anterior:
 *
 * - Ninguno es el rojo de error. Un contenido que parece roto no sirve.
 * - Los ocho tonos están bien separados entre sí, así dos carpetas contiguas
 *   nunca se confunden.
 *
 * Vive acá y no junto a la acción de alta porque un archivo `"use server"`
 * solo puede exportar funciones async, y esta lista la necesitan las dos
 * puntas: el formulario para pintar las muestras y el servidor para validar.
 */
export type ColorDeContenido = { hex: string; nombre: string };

export const PALETA_CONTENIDOS: ColorDeContenido[] = [
  { hex: "#F0B429", nombre: "Oro" },
  { hex: "#F2802E", nombre: "Naranja" },
  { hex: "#8FC33B", nombre: "Lima" },
  { hex: "#2EBF8F", nombre: "Esmeralda" },
  { hex: "#35B6D8", nombre: "Cian" },
  { hex: "#5B8DEF", nombre: "Azul" },
  { hex: "#A97BF2", nombre: "Violeta" },
  { hex: "#E56BB0", nombre: "Magenta" },
];

/** El que se ofrece marcado al crear: sigue la rotación de la lista. */
export function colorSugerido(cuantosHay: number): string {
  return PALETA_CONTENIDOS[cuantosHay % PALETA_CONTENIDOS.length].hex;
}

/** ¿Es uno de los nuestros? Lo que llega de un formulario no se confía. */
export function esColorDeContenido(valor: string): boolean {
  return PALETA_CONTENIDOS.some((color) => color.hex === valor);
}

/**
 * El fondo con que una build pinta la fila de su persona.
 *
 * Antes era el color con opacidad fija (`#RRGGBB1f`, un 12%). Sobre el carbón
 * del tema oscuro eso quedaba a un paso del fondo: la fila se fundía y el
 * sistema de colores, que es funcional y no decorativo, dejaba de servir.
 *
 * Ahora se mezcla de verdad contra una base que cambia con el tema, definida
 * en `globals.css`. La mezcla va en OKLab y no en sRGB: en sRGB un amarillo y
 * un azul mezclados al mismo porcentaje salen con brillos muy distintos, y las
 * filas de una misma composición se verían unas más pesadas que otras.
 */
export function tinteDeFila(hex: string): string {
  return `color-mix(in oklab, ${hex} var(--fuerza-fila), var(--base-fila))`;
}

/** El borde de esa misma fila: el mismo tono, con más color para marcarse. */
export function bordeDeFila(hex: string): string {
  return `color-mix(in oklab, ${hex} var(--fuerza-borde-fila), var(--base-fila))`;
}

/**
 * Blanco o negro, el que se lea mejor encima de ese color.
 *
 * Hace falta porque el color de una build se pinta lleno, sin mezclar con el
 * fondo: un amarillo y un azul marino son los dos colores válidos, y el mismo
 * texto encima funciona en uno y desaparece en el otro. La fórmula es la
 * luminancia relativa de WCAG, que es la que define el contraste real y no el
 * brillo aparente.
 */
export function textoSobre(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const canal = (c: number) => {
    const n = c / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  const luz = 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  // 0.45 y no 0.5: el umbral donde el blanco y el negro empatan en contraste
  // está por debajo del medio, porque el ojo pesa más las luces.
  return luz > 0.45 ? "#101013" : "#ffffff";
}
