/**
 * Acceso al catálogo de items y utilidades relacionadas.
 *
 * El catálogo lo genera `scripts/build-items.mts` desde los dumps del juego.
 * Ver `docs/ARQUITECTURA.md` para el porqué de versionarlo en el repositorio.
 */

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

/** Los nueve slots, en el orden en que se muestran en una build. */
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  "mainhand",
  "offhand",
  "head",
  "armor",
  "shoes",
  "cape",
  "food",
  "potion",
  "mount",
] as const;

export type CatalogItem = {
  /** `UniqueName` del juego, sin encantamiento. Ej: `T8_MAIN_SWORD` */
  id: string;
  en: string;
  es: string;
  slot: EquipmentSlot;
  /** 1 a 8 */
  tier: number;
  /** Solo en `mainhand`: ocupa las dos manos y bloquea el off-hand. */
  twoHanded?: true;
};

/** Nivel de encantamiento. En el juego se muestra como `.1` … `.4`. */
export type Enchantment = 0 | 1 | 2 | 3 | 4;

/** 1 Normal, 2 Bueno, 3 Excepcional, 4 Excelente, 5 Obra maestra. */
export type Quality = 1 | 2 | 3 | 4 | 5;

/** Una pieza de equipo dentro de una build. */
export type BuildItem = {
  id: string;
  ench?: Enchantment;
  quality?: Quality;
};

/**
 * Carga el catálogo completo (~1.700 items, 217 KB).
 *
 * Es un import dinámico a propósito: así el JSON solo entra en los bundles
 * que de verdad lo necesitan (el selector de items), y no en cada página.
 */
export async function loadCatalog(): Promise<CatalogItem[]> {
  const mod = await import("@/data/items.json");
  return mod.default as CatalogItem[];
}

/** Nombre del item en el idioma pedido. */
export function itemName(item: CatalogItem, locale: string): string {
  return locale.startsWith("es") ? item.es : item.en;
}

/**
 * El tier vive en el prefijo del identificador (`T8_MAIN_SWORD`), así que se
 * lee de ahí en vez de guardarse por separado. Dos copias del mismo dato son
 * dos copias que algún día no van a coincidir.
 */
export function tierOf(itemId: string): number | null {
  const match = /^T(\d)_/.exec(itemId);
  return match ? Number(match[1]) : null;
}

/**
 * URL del ícono, servida por nuestro proxy.
 *
 * Siempre a través de `/api/icon`, nunca directo al render de Albion: un
 * canvas que recibió imágenes de otro dominio no se puede exportar a PNG.
 */
export function iconUrl(
  item: BuildItem | string,
  options: { size?: number } = {},
): string {
  const { id, ench = 0, quality = 1 } =
    typeof item === "string" ? ({ id: item } as BuildItem) : item;

  const { size = 128 } = options;

  // El encantamiento forma parte del identificador que espera el juego.
  const identifier = ench > 0 ? `${id}@${ench}` : id;

  const params = new URLSearchParams();
  if (size !== 128) params.set("size", String(size));
  if (quality !== 1) params.set("quality", String(quality));

  const query = params.toString();
  return `/api/icon/${encodeURIComponent(identifier)}${query ? `?${query}` : ""}`;
}
