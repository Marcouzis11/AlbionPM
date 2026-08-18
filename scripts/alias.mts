/**
 * Hace que `@/…` funcione en los scripts que corre Node directamente.
 *
 * Los scripts de prueba importan módulos de `src/`, y esos módulos importan
 * entre ellos con el alias `@/` que define `tsconfig.json`. Node no lee ese
 * archivo: para él `@/lib/items` es un paquete de npm que no existe. Hasta
 * ahora no se notaba porque los módulos probados no importaban nada propio.
 *
 * Se engancha con `node --import ./scripts/alias.mts`. Traduce el alias a una
 * ruta y le agrega `.ts` cuando no trae extensión, que es como se escribe en
 * este proyecto y como Node no acepta en módulos ES.
 */

import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const raiz = path.resolve(import.meta.dirname, "..", "src");

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (!especificador.startsWith("@/")) return siguiente(especificador, contexto);

    let ruta = path.join(raiz, especificador.slice(2));
    if (!path.extname(ruta)) ruta += ".ts";

    return siguiente(pathToFileURL(ruta).href, contexto);
  },
});
