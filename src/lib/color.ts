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
