"use client";

import { useRef, useState } from "react";

/**
 * Arrastrar y soltar.
 *
 * Usa el arrastre nativo del navegador y no una librería. Eso no es ahorro de
 * dependencias por deporte: el arrastre nativo **no se activa con el dedo**, y
 * acá eso es exactamente lo que queremos. En el celular no hay arrastre que
 * pelee con el scroll de la lista, y queda el menú «Mover a», que es el que
 * sirve ahí. En la computadora arrastrás.
 *
 * El menú se queda también en la computadora, y no solo por costumbre: el
 * arrastre nativo no se puede hacer con el teclado, así que sacarlo dejaría a
 * quien no usa mouse sin ninguna forma de mover nada.
 *
 * ## Por qué el dato viaja en una variable de módulo
 *
 * `dataTransfer` no se puede leer durante `dragover` (el navegador lo esconde
 * hasta que soltás, por privacidad). Pero justamente en `dragover` hay que
 * decidir si esta zona acepta lo que viene, para pintarla o no. Como el
 * arrastre empieza y termina en la misma pestaña, alcanza con guardarlo acá.
 */

export type Arrastrado =
  | { tipo: "composicion"; id: string; origen: string }
  | { tipo: "build"; id: string; origen: string | null }
  | { tipo: "carpeta"; id: string; origen: string | null }
  | { tipo: "grupo"; id: string; position: number }
  /** Una persona dentro de un grupo, con todo lo que tenga anotado. */
  | { tipo: "lugar"; id: string };

let enVuelo: Arrastrado | null = null;

export function loQueSeArrastra(): Arrastrado | null {
  return enVuelo;
}

/** Lo que hay que ponerle a algo para poder tomarlo. */
export function propsDeArrastre(dato: Arrastrado) {
  return {
    draggable: true,
    onDragStart: (evento: React.DragEvent) => {
      enVuelo = dato;
      evento.dataTransfer.effectAllowed = "move";
      // Firefox no arranca el arrastre si no se escribe algo en el portapapeles
      // del evento, aunque después no lo leamos.
      evento.dataTransfer.setData("text/plain", dato.id);
      evento.stopPropagation();
    },
    onDragEnd: () => {
      enVuelo = null;
    },
  };
}

/**
 * Lo que hay que ponerle a una zona para poder soltar ahí.
 *
 * Devuelve `encima` para pintarla mientras el cursor está adentro. El contador
 * existe porque `dragleave` también salta al pasar por encima de los hijos: sin
 * llevar la cuenta, la zona parpadearía cada vez que el cursor cruza un ícono.
 */
export function useZonaDeSoltar(
  acepta: (dato: Arrastrado) => boolean,
  alSoltar: (dato: Arrastrado) => void,
) {
  const [encima, setEncima] = useState(false);
  const adentro = useRef(0);

  function limpiar() {
    adentro.current = 0;
    setEncima(false);
  }

  return {
    encima,
    props: {
      onDragEnter: () => {
        const dato = loQueSeArrastra();
        if (!dato || !acepta(dato)) return;
        adentro.current += 1;
        setEncima(true);
      },
      onDragOver: (evento: React.DragEvent) => {
        const dato = loQueSeArrastra();
        if (!dato || !acepta(dato)) return;
        // Sin esto el navegador rechaza la soltada: por omisión nada acepta.
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
      },
      onDragLeave: () => {
        adentro.current -= 1;
        if (adentro.current <= 0) limpiar();
      },
      onDrop: (evento: React.DragEvent) => {
        evento.preventDefault();
        evento.stopPropagation();
        limpiar();
        const dato = loQueSeArrastra();
        enVuelo = null;
        if (dato && acepta(dato)) alSoltar(dato);
      },
    },
  };
}
