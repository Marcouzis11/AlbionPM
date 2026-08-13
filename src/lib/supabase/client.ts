import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador.
 *
 * Usa la clave publicable, que viaja al cliente por diseño y es visible para
 * cualquiera. Eso no es un descuido: lo que protege los datos son las
 * políticas RLS de la base, no el secreto de esta clave.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
