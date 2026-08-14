import Link from "next/link";

/**
 * Pantallas de entrada y registro: centradas, sin barra lateral ni nada que
 * distraiga del único paso que hay que dar acá.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <Link
        href="/"
        className="rounded-lg text-2xl font-semibold tracking-tight transition-colors hover:text-accent"
      >
        Albion<span className="text-accent">PM</span>
      </Link>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        {children}
      </div>

      {/* Toda pantalla necesita una salida. Sin esto, quien entró por error
          solo tiene el botón de atrás del navegador. */}
      <Link
        href="/"
        className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        Volver a la portada
      </Link>
    </div>
  );
}
