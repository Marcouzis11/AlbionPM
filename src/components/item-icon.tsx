"use client";

import { useEffect, useState } from "react";

import { iconUrl, type BuildItem } from "@/lib/items";

/**
 * Ícono de un item del juego.
 *
 * ## Por qué reintenta
 *
 * Los íconos vienen del servicio de render de Albion Online, que falla de
 * forma pasajera: medido sobre 54 pedidos, cerca del 5% no responde. Los
 * mismos items funcionan al volver a pedirlos.
 *
 * El proxy del servidor ya reintenta, pero la primera vez que alguien abre una
 * composición se piden decenas de íconos a la vez y algunos caen igual. Sin
 * este reintento del navegador, esos quedan rotos hasta recargar la página —
 * que es exactamente lo que se veía.
 *
 * Después del primer pedido exitoso el ícono queda en el CDN por 30 días y se
 * sirve en 0,2 s, así que esto solo actúa en la primera carga.
 *
 * ## Por qué `<img>` y no `next/image`
 *
 * El plan Hobby de Vercel incluye 5.000 transformaciones de imagen por mes, y
 * una composición de dos grupos son cientos de íconos: el optimizador se
 * agotaría en pocas visitas sin aportar nada. Los íconos ya llegan como PNG
 * chicos y del tamaño pedido, y el caché lo controla el proxy.
 */

const MAX_REINTENTOS = 3;
const ESPERA_MS = 700;

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
  const [intento, setIntento] = useState(0);
  const [fallado, setFallado] = useState(false);

  const id = typeof item === "string" ? item : item.id;
  const ench = typeof item === "string" ? 0 : (item.ench ?? 0);

  // Si cambia el item, se empieza de cero: lo que falló era el anterior.
  useEffect(() => {
    setIntento(0);
    setFallado(false);
  }, [id, ench]);

  // Se pide al doble de resolución para que no se vea borroso en pantallas
  // retina y en celulares, que es donde más se mira esto.
  const base = iconUrl(item, { size: Math.min(size * 2, 217) });

  // El parámetro del reintento cambia la URL para saltear cualquier caché
  // intermedio que pudiera estar guardando la respuesta fallida.
  const src = intento === 0 ? base : `${base}${base.includes("?") ? "&" : "?"}r=${intento}`;

  function onError() {
    if (intento < MAX_REINTENTOS) {
      setTimeout(() => setIntento((n) => n + 1), ESPERA_MS * (intento + 1));
    } else {
      setFallado(true);
    }
  }

  // Agotados los reintentos, un recuadro con las iniciales del item. Es más
  // útil que el ícono de imagen rota del navegador: al menos se lee qué era.
  if (fallado) {
    return (
      <span
        title={name ?? id}
        style={{ width: size, height: size, fontSize: Math.max(8, size / 4.5) }}
        className={`inline-flex items-center justify-center rounded border border-dashed border-border text-center leading-tight text-muted ${className ?? ""}`}
      >
        {id.replace(/^T\d_/, "").slice(0, 4)}
      </span>
    );
  }

  return (
    <img
      key={intento}
      src={src}
      alt={name ?? ""}
      title={name}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={onError}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
