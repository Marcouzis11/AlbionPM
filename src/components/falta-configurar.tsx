/**
 * Aviso de configuración faltante.
 *
 * Se muestra en lugar de dejar reventar la página. Un 500 no dice nada; esto
 * dice exactamente qué falta y dónde ponerlo.
 */
export function FaltaConfigurar() {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-danger/40 bg-danger/5 p-6">
      <h1 className="text-lg font-semibold">Falta configurar la base de datos</h1>

      <p className="text-sm leading-relaxed text-muted">
        Esta parte de AlbionPM necesita conectarse a Supabase, y no encuentra las
        credenciales. El resto del sitio funciona igual.
      </p>

      <div className="space-y-2 text-sm">
        <p className="font-medium">En Vercel → Settings → Environment Variables:</p>
        <ul className="space-y-1 font-mono text-xs text-muted">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</li>
        </ul>
        <p className="text-xs text-muted">
          Después de agregarlas hay que volver a desplegar para que tomen efecto.
        </p>
      </div>

      <p className="text-sm text-muted">
        Para desarrollo local, las mismas dos variables van en{" "}
        <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">.env.local</code>.
      </p>
    </div>
  );
}
