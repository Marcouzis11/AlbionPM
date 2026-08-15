/**
 * Lo que se ve mientras carga una sección.
 *
 * Sin esto, cambiar de Party Maker a Builds dejaba la pantalla anterior
 * congelada hasta que el servidor contestaba: la aplicación parecía trabada,
 * aunque estuviera trabajando. El navegador tampoco daba señal, porque no es
 * una carga de página sino una navegación del lado del cliente.
 *
 * Es un esqueleto y no una ruedita girando. La ruedita dice «esperá» y nada
 * más; el esqueleto además dice qué va a aparecer y dónde, así que cuando
 * llegan los datos de verdad la vista no se reacomoda: lo que había reservado
 * el lugar se llena.
 *
 * Se anima con `animate-pulse`, que es lo único que sobrevivió a la limpieza de
 * animaciones: acá el movimiento no compite con nada porque todavía no hay nada
 * con qué competir, y es lo que distingue «cargando» de «vacío».
 */
export default function Cargando() {
  return (
    <div className="flex h-full flex-col gap-4" aria-busy role="status">
      <span className="sr-only">Cargando…</span>

      <div className="shrink-0 space-y-2">
        <div className="h-7 w-44 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-72 animate-pulse rounded bg-surface-2" />
      </div>

      <div className="flex shrink-0 gap-2">
        <div className="h-10 w-56 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-10 w-40 animate-pulse rounded-lg bg-surface-2" />
        <div className="ml-auto h-10 w-32 animate-pulse rounded-lg bg-surface-2" />
      </div>

      {/* Dos columnas, que es la forma que tienen tanto Party Maker como
          Builds: la lista angosta a un lado y el trabajo al otro. */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        <div className="space-y-1.5 rounded-xl border border-border bg-surface p-2">
          {Array.from({ length: 6 }, (_, fila) => (
            <div key={fila} className="h-9 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>

        <div className="grid content-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, tarjeta) => (
            <div
              key={tarjeta}
              className="h-44 animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
