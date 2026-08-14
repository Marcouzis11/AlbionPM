/**
 * Configuración de Supabase.
 *
 * Existe para distinguir dos cosas que se ven igual desde afuera y no lo son:
 * la aplicación rota, y la aplicación sin configurar. Sin esto, olvidarse una
 * variable de entorno produce un error 500 opaco y media hora de buscar un bug
 * que no existe.
 */

export type SupabaseConfig = { url: string; key: string };

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
