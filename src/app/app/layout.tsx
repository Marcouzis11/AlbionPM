import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Puerta de entrada a todo lo privado.
 *
 * `getUser()` y no `getSession()`: el primero valida el token contra Supabase,
 * el segundo se limita a leer la cookie. Para decidir si alguien puede pasar,
 * hay que validar.
 */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/entrar");

  return <>{children}</>;
}
