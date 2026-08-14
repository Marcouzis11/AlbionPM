import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { FaltaConfigurar } from "@/components/falta-configurar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crear cuenta en AlbionPM" };

export default async function RegistroPage() {
  if (!isSupabaseConfigured()) return <FaltaConfigurar />;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) redirect("/app");

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Crear cuenta</h1>
      <p className="mb-6 text-sm text-muted">
        Tus builds y composiciones quedan guardadas y las abrís desde donde
        quieras.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
