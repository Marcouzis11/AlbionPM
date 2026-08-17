import type { Metadata } from "next";

import { Novedades } from "@/components/novedades";

export const metadata: Metadata = { title: "Novedades de AlbionPM" };

/**
 * Las novedades no consultan la base: la lista vive en el código.
 *
 * Es a propósito. Son unas pocas líneas de texto que cambian cuando cambia la
 * aplicación, no cuando el usuario hace algo, así que darles una tabla sería
 * pagar un viaje de red en cada visita para leer siempre lo mismo.
 */
export default function NovedadesPage() {
  return <Novedades />;
}
