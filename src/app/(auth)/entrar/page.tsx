import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { FaltaConfigurar } from "@/components/falta-configurar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Entrar — AlbionPM" };

export default async function EntrarPage() {
  if (!isSupabaseConfigured()) return <FaltaConfigurar />;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // Quien ya tiene sesión no tiene nada que hacer en la pantalla de ingreso.
  if (data.user) redirect("/app");

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Entrar</h1>
      <p className="mb-6 text-sm text-muted">
        Para armar y guardar tus composiciones.
      </p>
      <AuthForm mode="signin" />
    </>
  );
}
