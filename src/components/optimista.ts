"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

/**
 * Mostrar los cambios antes de que el servidor los confirme.
 *
 * Toda escritura de esta aplicación sigue el mismo camino: se llama a una
 * acción del servidor y después se pide de nuevo la pantalla. Entre esas dos
 * cosas hay un viaje de red, y durante ese viaje la interfaz seguía mostrando
 * los datos viejos: elegías un color y no pasaba nada, creabas una carpeta y no
 * aparecía, movías una composición y se quedaba donde estaba. La acción se
 * sentía rota aunque estuviera funcionando.
 *
 * Este enganche guarda lo que acabás de hacer y lo pinta encima de lo que llegó
 * del servidor, hasta que el servidor lo confirma. No reemplaza la escritura:
 * la acompaña.
 *
 * ## Lo que resuelve y no se ve
 *
 * - **Respuestas que llegan tarde.** Se anota el número de cambio de cada
 *   elemento. Si cambiás dos veces seguidas, la respuesta de la primera ya no
 *   borra lo que mostró la segunda.
 * - **Altas sin identificador.** Al crear algo todavía no hay `id`, así que se
 *   inventa uno provisional. Cuando el servidor contesta se descarta el
 *   provisional y queda el de verdad, que ya viene en los datos nuevos.
 * - **Errores.** Si la acción devuelve un error, lo que se había pintado se
 *   descarta y se avisa. Sin esto la pantalla mentiría hasta que recargues.
 */

type ConId = { id: string };

/** Lo que devuelven las acciones de este proyecto cuando algo sale mal. */
type Resultado = { error?: string } | void | undefined;

export function useOptimista<T extends ConId>(delServidor: T[]) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [parches, setParches] = useState<Map<string, Partial<T>>>(() => new Map());
  const [agregados, setAgregados] = useState<T[]>([]);
  const [quitados, setQuitados] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const ultimo = useRef(new Map<string, number>());

  /** Los datos del servidor con lo pendiente aplicado encima. */
  const lista = useMemo(() => {
    const conocidos = new Set(delServidor.map((x) => x.id));
    const base = delServidor
      .filter((x) => !quitados.has(x.id))
      .map((x) => {
        const parche = parches.get(x.id);
        return parche ? { ...x, ...parche } : x;
      });

    // Los provisionales se caen solos en cuanto el servidor devuelve el real.
    return [...base, ...agregados.filter((a) => !conocidos.has(a.id))];
  }, [delServidor, parches, agregados, quitados]);

  function limpiarParche(id: string) {
    setParches((previo) => {
      const siguiente = new Map(previo);
      siguiente.delete(id);
      return siguiente;
    });
  }

  /**
   * Corre la acción y suelta lo pendiente recién cuando termina.
   *
   * Todo pasa dentro de UNA transición: el pedido, la vuelta a pedir la
   * pantalla y el soltar. React confirma las tres juntas, así que no hay ningún
   * cuadro intermedio en el que lo pendiente ya se soltó pero los datos nuevos
   * todavía no llegaron. Con dos transiciones separadas, ese cuadro existe y es
   * exactamente el parpadeo que se quería sacar.
   */
  function correr(
    accion: () => Promise<Resultado>,
    alFallar: () => void,
    alTerminar?: () => void,
  ) {
    startTransition(async () => {
      const resultado = await accion();
      if (resultado && "error" in resultado && resultado.error) {
        alFallar();
        setError(resultado.error);
        return;
      }
      setError(null);
      router.refresh();
      alTerminar?.();
    });
  }

  /** Cambia algo que ya existe. */
  function editar(id: string, parche: Partial<T>, accion: () => Promise<Resultado>) {
    const numero = (ultimo.current.get(id) ?? 0) + 1;
    ultimo.current.set(id, numero);

    setParches((previo) => {
      const siguiente = new Map(previo);
      siguiente.set(id, { ...previo.get(id), ...parche });
      return siguiente;
    });

    correr(accion, () => limpiarParche(id), () => {
      // Si nadie escribió después, se suelta el parche. Si alguien escribió, el
      // suyo manda y este ya no tiene nada que decir.
      if (ultimo.current.get(id) === numero) limpiarParche(id);
    });
  }

  /**
   * Crea algo. `provisional` es cómo se va a ver mientras tanto; su `id` no
   * existe en la base, así que no puede usarse para nada más que mostrarlo.
   */
  function agregar(provisional: T, accion: () => Promise<Resultado>) {
    const sacar = () =>
      setAgregados((previo) => previo.filter((a) => a.id !== provisional.id));

    setAgregados((previo) => [...previo, provisional]);
    correr(accion, sacar, sacar);
  }

  /** Borra algo: desaparece de la lista mientras el servidor lo confirma. */
  function quitar(id: string, accion: () => Promise<Resultado>) {
    setQuitados((previo) => new Set(previo).add(id));
    correr(accion, () => {
      setQuitados((previo) => {
        const siguiente = new Set(previo);
        siguiente.delete(id);
        return siguiente;
      });
    });
  }

  /** Para lo que no cambia una lista, pero igual tarda. */
  function hacer(accion: () => Promise<Resultado>) {
    correr(accion, () => {});
  }

  return { lista, editar, agregar, quitar, hacer, error, limpiarError: () => setError(null) };
}

/** Un identificador que solo vive hasta que el servidor devuelve el de verdad. */
export function idProvisional(): string {
  return `provisional-${Math.random().toString(36).slice(2)}`;
}
