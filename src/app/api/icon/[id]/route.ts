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
 * Desde algunas redes, el origen no contesta nada ante ciertos pedidos: se
 * queda colgado hasta que el cliente se rinde (medido: 25 s sin respuesta).
 * Desde Vercel el mismo pedido devuelve 404 en menos de medio segundo, así
 * que el comportamiento depende de la red. El límite es la red de seguridad
 * para que un caso así no cuelgue la petición de cada persona que abra un
 * link compartido.
 */
const UPSTREAM_TIMEOUT_MS = 6000;

/**
 * El origen falla de forma esporádica bajo ráfagas. Medido con 20 íconos
 * pedidos a la vez, apareció un 404 para un item que sí existe y que responde
 * 200 al reintentarlo. Una composición de dos grupos pide decenas de íconos
 * distintos a la vez, así que es el escenario habitual, no el excepcional.
 *
 * Un reintento alcanza: con el caché de 30 días, cada ícono golpea el origen
 * una sola vez y después lo sirve el CDN.
 */
const UPSTREAM_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function clampInt(value: string | null, min: number, max: number, fallback: number) {
  // `Number(null)` es 0, no NaN, y `Number("")` también es 0. Sin este
  // descarte previo, un parámetro ausente se "colaba" como 0 y terminaba
  // recortado al mínimo en vez de usar el valor por defecto: pedíamos íconos
  // de 1×1 píxel y el servicio del juego respondía 500.
  if (value === null || value.trim() === "") return fallback;

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

      // Un 404 tampoco se da por definitivo al primer intento: bajo ráfaga se
      // observó que el origen devuelve 404 para items que sí existen. Darlo
      // por bueno dejaría un hueco visible en la composición durante todo lo
      // que dure el caché.
      lastFailure = "status";
      lastStatus = response.status;
    } catch (error) {
      lastFailure =
        error instanceof Error && error.name === "TimeoutError" ? "timeout" : "status";
    }
  }

  const missing = lastStatus === 404;

  return new Response(
    missing
      ? "Ese item no tiene ícono en el servicio del juego"
      : lastFailure === "timeout"
        ? "El servicio de íconos no respondió a tiempo"
        : "El servicio de íconos devolvió un error",
    {
      status: missing ? 404 : lastFailure === "timeout" ? 504 : 502,
      headers: {
        // Los fallos NO se cachean. Medido: el servicio del juego falla de
        // forma pasajera en cerca del 5% de los pedidos. Si el CDN guardara
        // ese error, el reintento del navegador recibiría el fallo guardado
        // en vez de volver a intentar, y el ícono quedaría roto durante todo
        // lo que durara el caché. Cachear un error es convertir un problema
        // de un segundo en uno de un minuto.
        //
        // El 404 sí se cachea un rato: hay items que realmente no tienen
        // ícono, y no tiene sentido preguntar por ellos en cada visita.
        "cache-control": missing
          ? "public, max-age=600"
          : "no-store, must-revalidate",
        // Deja rastro de qué contestó el origen. Sin esto, un fallo en
        // producción es indistinguible de otro y no hay nada que investigar.
        "x-upstream-status": String(lastStatus),
      },
    },
  );
}
