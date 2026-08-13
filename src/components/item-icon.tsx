import { iconUrl, type BuildItem } from "@/lib/items";

/**
 * Ícono de un item del juego.
 *
 * Usa `<img>` y no `next/image` deliberadamente. El plan Hobby de Vercel
 * incluye 5.000 transformaciones de imagen por mes, y una composición de dos
 * grupos son ~360 íconos: el optimizador se agotaría en pocas visitas para no
 * aportar nada. Los íconos ya vienen como PNG chicos y del tamaño pedido, y
 * el caché lo controla nuestro proxy en `/api/icon`.
 */

type Props = {
  item: BuildItem | string;
  /** Nombre del item, para lectores de pantalla y para cuando no carga. */
  name?: string;
  /** Lado del cuadrado, en píxeles. El origen sirve hasta 217. */
  size?: number;
  className?: string;
  /** La primera fila de una composición no debería cargar en diferido. */
  priority?: boolean;
};

export function ItemIcon({
  item,
  name,
  size = 48,
  className,
  priority = false,
}: Props) {
  // Se pide al doble de resolución para que no se vea borroso en pantallas
  // retina y en celulares, que es donde más se mira esto.
  const src = iconUrl(item, { size: Math.min(size * 2, 217) });

  return (
    <img
      src={src}
      alt={name ?? ""}
      title={name}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
