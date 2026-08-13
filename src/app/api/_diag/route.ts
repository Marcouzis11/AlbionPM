/**
 * Diagnóstico temporal del servicio de íconos.
 *
 * Existe para responder una sola pregunta: el render de Albion Online contesta
 * 200 desde una conexión doméstica y 500 desde Vercel. ¿Es por las cabeceras
 * que mandamos, por los parámetros, o por la IP de origen?
 *
 * BORRAR una vez respondida.
 */

const CASES: { name: string; url: string; headers?: Record<string, string> }[] = [
  {
    name: "con nuestras cabeceras",
    url: "https://render.albiononline.com/v1/item/T8_MAIN_SWORD.png?size=128&quality=1",
    headers: {
      "user-agent": "AlbionPM/0.1 (+https://albion-pm.vercel.app)",
      accept: "image/png,image/*;q=0.8,*/*;q=0.5",
    },
  },
  {
    name: "sin cabeceras",
    url: "https://render.albiononline.com/v1/item/T8_MAIN_SWORD.png?size=128&quality=1",
  },
  {
    name: "sin parametros",
    url: "https://render.albiononline.com/v1/item/T8_MAIN_SWORD.png",
  },
  {
    name: "user-agent de navegador",
    url: "https://render.albiononline.com/v1/item/T8_MAIN_SWORD.png?size=128&quality=1",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  },
];

export async function GET() {
  const results = [];

  for (const testCase of CASES) {
    const started = Date.now();
    try {
      const response = await fetch(testCase.url, {
        headers: testCase.headers,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const body = response.ok ? null : (await response.text()).slice(0, 300);
      results.push({
        caso: testCase.name,
        status: response.status,
        tipo: response.headers.get("content-type"),
        servidor: response.headers.get("server"),
        cf: response.headers.get("cf-ray"),
        ms: Date.now() - started,
        cuerpo: body,
      });
    } catch (error) {
      results.push({
        caso: testCase.name,
        error: error instanceof Error ? error.name : "desconocido",
        ms: Date.now() - started,
      });
    }
  }

  return Response.json(
    { region: process.env.VERCEL_REGION ?? "local", results },
    { headers: { "cache-control": "no-store" } },
  );
}
