import type { NextRequest } from "next/server";

/**
 * Proxy de los íconos de items del render oficial de Albion Online.
 *
 *   /api/icon/T8_MAIN_SWORD
 *   /api/icon/T8_MAIN_SWORD@2?quality=4&size=64
 *
 * No es una optimización: es un requisito.
 *
 * El export a PNG de una composición dibuja el DOM en un `<canvas>`. Un canvas
 * que recibió imágenes de otro dominio queda "contaminado" y el navegador
 * prohíbe exportarlo. Sirviendo los íconos desde nuestro propio origen, el
 * problema no existe.
 *
 * De paso, concentra el caché en un solo lugar y nos deja sobrevivir a un
 * cambio de URL del servicio del juego editando un único archivo.
 */

const RENDER_BASE = "https://render.albiononline.com/v1/item";

/**
 * `T8_MAIN_SWORD`, opcionalmente con encantamiento `@0`…`@4`.
 *
 * Restringir la forma del identificador es lo que impide que esta ruta se
 * convierta en un proxy abierto: el host de destino está fijo en el código,
 * y esto evita que alguien escape del path con `../`.
 */
const ITEM_ID = /^[A-Z0-9_]{3,64}(@[0-4])?$/;

/** El servicio del juego acepta 1 a 217 px. */
const MAX_SIZE = 217;
const DEFAULT_SIZE = 128;

/** 1 Normal, 2 Bueno, 3 Excepcional, 4 Excelente, 5 Obra maestra. */
const DEFAULT_QUALITY = 1;

/** 30 días. Los íconos solo cambian cuando sale un parche. */
const CACHE_SECONDS = 60 * 60 * 24 * 30;

/**
 * El servicio del juego **no responde 404 ante un item inexistente: se queda
 * colgado indefinidamente** (verificado contra el origen). Sin este límite, un
 * identificador mal escrito en una composición compartida dejaría la función
 * colgada para cada persona que abra el link, hasta agotar el tiempo máximo de
 * ejecución. El timeout no es defensa preventiva: es la respuesta a un
 * comportamiento real del origen.
 */
const UPSTREAM_TIMEOUT_MS = 6000;

/**
 * El origen tampoco aguanta ráfagas: medido con 20 pedidos concurrentes,
 * 17 respondieron y 3 se quedaron colgados. Una composición de dos grupos
 * pide decenas de íconos distintos a la vez, así que un fallo aislado es
 * esperable y no debería dejar un casillero vacío en la pantalla.
 *
 * Un reintento alcanza: con el caché de 30 días, cada ícono golpea el origen
 * una sola vez y después lo sirve el CDN.
 */
const UPSTREAM_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function clampInt(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/icon/[id]">) {
  const { id } = await ctx.params;

  // El `@` del encantamiento llega percent-encoded desde algunos clientes.
  const itemId = decodeURIComponent(id).toUpperCase();

  if (!ITEM_ID.test(itemId)) {
    return new Response("Identificador de item inválido", { status: 400 });
  }

  const search = request.nextUrl.searchParams;
  const size = clampInt(search.get("size"), 1, MAX_SIZE, DEFAULT_SIZE);
  const quality = clampInt(search.get("quality"), 1, 5, DEFAULT_QUALITY);

  const upstream = `${RENDER_BASE}/${encodeURIComponent(itemId)}.png?size=${size}&quality=${quality}`;

  let lastFailure: "timeout" | "status" = "timeout";
  let lastStatus = 0;

  for (let attempt = 0; attempt < UPSTREAM_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);

    try {
      const response = await fetch(upstream, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: "no-store",
        headers: {
          // Identificarse es buena práctica con un servicio ajeno y gratuito,
          // y además varios servicios rechazan pedidos sin User-Agent.
          "user-agent": "AlbionPM/0.1 (+https://albion-pm.vercel.app)",
          accept: "image/png,image/*;q=0.8,*/*;q=0.5",
        },
      });

      if (response.ok) {
        return new Response(response.body, {
          status: 200,
          headers: {
            "content-type": response.headers.get("content-type") ?? "image/png",
            "cache-control": `public, max-age=${CACHE_SECONDS}, immutable`,
          },
        });
      }

      // Un 404 del origen es definitivo: no tiene sentido reintentarlo.
      if (response.status === 404) {
        return new Response("Ícono no encontrado", {
          status: 404,
          headers: { "cache-control": "public, max-age=3600" },
        });
      }

      lastFailure = "status";
      lastStatus = response.status;
    } catch (error) {
      lastFailure =
        error instanceof Error && error.name === "TimeoutError" ? "timeout" : "status";
    }
  }

  // Caché corto a propósito: si fue un problema pasajero del origen, queremos
  // que el próximo intento lo resuelva, no que el fallo quede pegado 30 días.
  return new Response(
    lastFailure === "timeout"
      ? "El servicio de íconos no respondió; puede que el item no exista"
      : "El servicio de íconos devolvió un error",
    {
      status: lastFailure === "timeout" ? 504 : 502,
      headers: {
        "cache-control": "public, max-age=60",
        // Deja rastro de qué contestó el origen. Sin esto, un fallo en
        // producción es indistinguible de otro y no hay nada que investigar.
        "x-upstream-status": String(lastStatus),
      },
    },
  );
}
