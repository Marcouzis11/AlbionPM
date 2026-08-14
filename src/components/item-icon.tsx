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

/**
 * Ruta del ícono guardado en el repositorio.
 *
 * Se intenta SIEMPRE primero. Lo sirve el CDN sin ejecutar ninguna función y
 * sin depender del servicio de Albion, así que es lo más rápido posible y
 * además no falla.
 *
 * No hay manifiesto de qué íconos existen en local: mandar una lista de miles
 * de identificadores al navegador para evitar un 404 ocasional costaría más de
 * lo que ahorra. Si el archivo no está, se cae al proxy y listo.
 */
function rutaLocal(id: string, ench: number): string {
  const nombre = ench > 0 ? `${id}@${ench}` : id;
  return `/icons/${encodeURIComponent(nombre)}.png`;
}

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
  const proxy = iconUrl(item, { size: Math.min(size * 2, 217) });

  // Intento 0: el archivo local. Del 1 en adelante: el proxy, que a su vez
  // reintenta contra el servicio del juego. El parámetro cambia la URL para
  // saltear cualquier caché intermedio que guardara la respuesta fallida.
  const src =
    intento === 0
      ? rutaLocal(id, ench)
      : intento === 1
        ? proxy
        : `${proxy}${proxy.includes("?") ? "&" : "?"}r=${intento}`;

  function onError() {
    if (intento < MAX_REINTENTOS) {
      // Pasar del archivo local al proxy es instantáneo: no es un fallo del
      // servicio, es simplemente un ícono que no descargamos. Esperar ahí sería
      // agregar medio segundo de nada.
      const espera = intento === 0 ? 0 : ESPERA_MS * intento;
      setTimeout(() => setIntento((n) => n + 1), espera);
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
      className={`object-contain ${className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}
