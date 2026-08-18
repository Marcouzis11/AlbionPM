"use client";

import { Download, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { importar } from "@/app/actions/transferir";
import { nombreDeArchivo } from "@/lib/transferencia";

/**
 * Bajar y subir archivos de AlbionPM.
 *
 * El archivo se arma en el navegador y no se sube a ningún lado: se genera, se
 * baja y se termina. Compartirlo es cosa tuya, por Discord o por donde quieras,
 * y eso también significa que una composición exportada no depende de que este
 * servicio siga existiendo.
 */

/** Baja un objeto como archivo. */
export function descargar(datos: unknown, base: string) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreDeArchivo(base);
  enlace.click();
  // Sin esto el navegador se queda con el archivo entero en memoria hasta que
  // se cierre la pestaña.
  URL.revokeObjectURL(url);
}

/**
 * El aviso de que algo salió bien o mal.
 *
 * Va en el `body` y con posición fija, fuera del flujo de la página. Antes se
 * dibujaba como un hermano más de los botones: al aparecer le sumaba una
 * línea a esa fila, la fila crecía, y el título de la pantalla se corría de
 * lugar. Un aviso no puede reacomodar lo que estabas mirando.
 *
 * El de éxito se va solo a los seis segundos; el de error se queda hasta que lo
 * cierres, porque si algo falló probablemente quieras leerlo dos veces.
 */
function Aviso({
  texto,
  esError,
  onCerrar,
}: {
  texto: string;
  esError: boolean;
  onCerrar: () => void;
}) {
  useEffect(() => {
    if (esError) return;
    const reloj = setTimeout(onCerrar, 6000);
    return () => clearTimeout(reloj);
  }, [esError, onCerrar]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="alert"
      className={`fixed bottom-4 left-1/2 z-50 flex max-w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${
        esError
          ? "border-danger/40 bg-danger/10 text-danger"
          : "border-success/40 bg-success/10 text-success"
      }`}
    >
      <span className="min-w-0 flex-1">{texto}</span>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar el aviso"
        className="-mr-1 -mt-0.5 shrink-0 rounded p-1 opacity-70 hover:opacity-100"
      >
        <X size={14} aria-hidden />
      </button>
    </div>,
    document.body,
  );
}

/** Un botón que exporta lo que le devuelva `obtener`. */
export function BotonExportar({
  obtener,
  nombre,
  etiqueta,
  compacto = false,
}: {
  obtener: () => Promise<{ archivo?: unknown; error?: string }>;
  /** Con qué nombre se baja. */
  nombre: string;
  etiqueta: string;
  compacto?: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function exportar() {
    setError(null);
    startTransition(async () => {
      const resultado = await obtener();
      if (resultado.error || !resultado.archivo) {
        setError(resultado.error ?? "No se pudo exportar.");
        return;
      }
      descargar(resultado.archivo, nombre);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={exportar}
        disabled={pendiente}
        aria-label={etiqueta}
        title={etiqueta}
        className={
          compacto
            ? "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
            : "flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
        }
      >
        <Download size={compacto ? 14 : 15} aria-hidden />
        {!compacto && <span className="hidden sm:inline">Exportar</span>}
      </button>
      {error && <Aviso texto={error} esError onCerrar={() => setError(null)} />}
    </>
  );
}

/**
 * El botón de importar: abre el explorador y manda el contenido al servidor.
 *
 * El archivo se lee en el navegador y viaja como texto. Se valida entero del
 * lado del servidor antes de escribir una sola fila: un archivo lo edita
 * cualquiera con un editor de texto, así que lo que llega no se confía.
 */
export function BotonImportar({ gameId }: { gameId: string }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ error?: string; mensaje?: string } | null>(null);

  function elegido(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    // Se limpia enseguida para que elegir el MISMO archivo dos veces vuelva a
    // disparar el evento; si no, el navegador considera que no cambió nada.
    evento.target.value = "";
    if (!archivo) return;

    setAviso(null);
    startTransition(async () => {
      const texto = await archivo.text();
      const resultado = await importar(gameId, texto);
      setAviso(resultado);
      if (!resultado.error) router.refresh();
    });
  }

  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept="application/json,.json"
        onChange={elegido}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={pendiente}
        className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        <Upload size={15} aria-hidden />
        <span className="hidden sm:inline">{pendiente ? "Importando…" : "Importar"}</span>
      </button>

      {aviso && (
        <Aviso
          texto={aviso.error ?? aviso.mensaje ?? ""}
          esError={Boolean(aviso.error)}
          onCerrar={() => setAviso(null)}
        />
      )}
    </>
  );
}
