import Link from "next/link";

/**
 * Pantallas de entrada y registro: centradas, sin barra lateral ni nada que
 * distraiga del único paso que hay que dar acá.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-2xl font-semibold tracking-tight">
        Albion<span className="text-accent">PM</span>
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        {children}
      </div>
    </div>
  );
}
