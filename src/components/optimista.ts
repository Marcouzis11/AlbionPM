"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

/**
 * Mostrar los cambios antes de que el servidor los confirme.
 *
 * Toda escritura de esta aplicación llama a una acción y después vuelve a pedir
 * la pantalla. Entre esas dos cosas hay un viaje de red, y durante ese viaje la
 * interfaz mostraba los datos viejos: elegías un color y no pasaba nada, movías
 * una composición y se quedaba donde estaba.
 *
 * ## Por qué no se suelta lo pendiente "cuando termina"
 *
 * La versión anterior soltaba el estado pendiente después de llamar a
 * `router.refresh()`. Pero `refresh()` no devuelve una promesa: dispara el
 * pedido y sigue de largo. Así que lo pendiente se soltaba enseguida, la
 * pantalla volvía al dato viejo, y recién cuando llegaba el refresco aparecía
 * el cambio. Eso es exactamente el salto de ida y vuelta que se buscaba evitar,
 * y ninguna cantidad de esperas o temporizadores lo arregla bien: siempre hay
 * una carrera.
 *
 * Acá no se suelta por tiempo sino por evidencia. Junto a cada cambio se guarda
 * cómo estaba el dato ANTES. Mientras el servidor siga mandando ese valor
 * viejo, es que todavía no se enteró y se sigue mostrando el nuestro. En cuanto
 * manda algo distinto, ya se enteró y manda él. No hay carrera posible: el
 * cambio se ve una sola vez.
 *
 * ## Lo demás que resuelve
 *
 * - **Altas sin identificador.** Al crear algo todavía no hay `id`, así que se
 *   inventa uno provisional y se recuerda qué identificadores existían. El
 *   provisional se va en cuanto aparece uno que no estaba.
 * - **Errores.** Si la acción falla, lo pintado se descarta y se avisa. Sin
 *   esto la pantalla mentiría hasta recargar.
 */

type ConId = { id: string };

/** Lo que devuelven las acciones de este proyecto cuando algo sale mal. */
type Resultado = { error?: string } | void | undefined;

type Pendiente<T> = {
  parche: Partial<T>;
  /** Los mismos campos, como los tenía el servidor cuando se anotó el cambio. */
  antes: Partial<T>;
};

type Alta<T> = {
  provisional: T;
  /** Los identificadores que existían al crear. */
  previos: Set<string>;
};

export function useOptimista<T extends ConId>(delServidor: T[]) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [parches, setParches] = useState<Map<string, Pendiente<T>>>(() => new Map());
  const [altas, setAltas] = useState<Alta<T>[]>([]);
  const [quitados, setQuitados] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  /** Los datos del servidor con lo que todavía no confirmó aplicado encima. */
  const lista = useMemo(() => {
    const base = delServidor
      .filter((x) => !quitados.has(x.id))
      .map((x) => {
        const pendiente = parches.get(x.id);
        if (!pendiente) return x;

        // Si el servidor ya cambió alguno de los campos que tocamos, se entiende
        // que llegó la novedad y su versión manda.
        const claves = Object.keys(pendiente.parche) as (keyof T)[];
        const yaLlego = claves.some((clave) => x[clave] !== pendiente.antes[clave]);
        return yaLlego ? x : { ...x, ...pendiente.parche };
      });

    const enElServidor = new Set(delServidor.map((x) => x.id));
    const provisionales = altas
      .filter((alta) => {
        // Mientras no aparezca ningún identificador nuevo, el alta sigue en
        // viaje y su provisional se muestra.
        for (const id of enElServidor) if (!alta.previos.has(id)) return false;
        return true;
      })
      .map((alta) => alta.provisional);

    return [...base, ...provisionales];
  }, [delServidor, parches, altas, quitados]);

  function correr(accion: () => Promise<Resultado>, alFallar: () => void) {
    startTransition(async () => {
      const resultado = await accion();
      if (resultado && "error" in resultado && resultado.error) {
        alFallar();
        setError(resultado.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  /** Cambia algo que ya existe. */
  function editar(id: string, parche: Partial<T>, accion: () => Promise<Resultado>) {
    const actual = delServidor.find((x) => x.id === id);
    const antes: Partial<T> = {};
    if (actual) {
      for (const clave of Object.keys(parche) as (keyof T)[]) antes[clave] = actual[clave];
    }

    setParches((previo) => new Map(previo).set(id, { parche, antes }));

    correr(accion, () =>
      setParches((previo) => {
        const siguiente = new Map(previo);
        siguiente.delete(id);
        return siguiente;
      }),
    );
  }

  /**
   * Crea algo. `provisional` es cómo se ve mientras tanto; su `id` no existe en
   * la base, así que no sirve para nada más que mostrarlo.
   */
  function agregar(provisional: T, accion: () => Promise<Resultado>) {
    const alta: Alta<T> = {
      provisional,
      previos: new Set(delServidor.map((x) => x.id)),
    };
    setAltas((previo) => [...previo, alta]);

    correr(accion, () =>
      setAltas((previo) => previo.filter((a) => a.provisional.id !== provisional.id)),
    );
  }

  /** Borra algo: desaparece de la lista mientras el servidor lo confirma. */
  function quitar(id: string, accion: () => Promise<Resultado>) {
    setQuitados((previo) => new Set(previo).add(id));

    correr(accion, () =>
      setQuitados((previo) => {
        const siguiente = new Set(previo);
        siguiente.delete(id);
        return siguiente;
      }),
    );
  }

  /** Para lo que no cambia esta lista, pero igual tarda. */
  function hacer(accion: () => Promise<Resultado>) {
    correr(accion, () => {});
  }

  return { lista, editar, agregar, quitar, hacer, error };
}

/** Un identificador que solo vive hasta que el servidor devuelve el de verdad. */
export function idProvisional(): string {
  return `${PREFIJO}${Math.random().toString(36).slice(2)}`;
}

const PREFIJO = "provisional-";

/**
 * ¿Este identificador es de algo que todavía se está creando?
 *
 * Sirve para apagar las acciones de una fila recién creada. Mientras el
 * servidor no conteste, su identificador no existe en la base: pedirle que
 * cambie de color no cambia nada y no falla, simplemente no encuentra ninguna
 * fila. La interfaz tiene que decir «esperá» en vez de aceptar clicks que se
 * pierden.
 */
export function esProvisional(id: string): boolean {
  return id.startsWith(PREFIJO);
}
