"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
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
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
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
        <p
          role="alert"
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            aviso.error
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-success/40 bg-success/10 text-success"
          }`}
        >
          {aviso.error ?? aviso.mensaje}
        </p>
      )}
    </>
  );
}
