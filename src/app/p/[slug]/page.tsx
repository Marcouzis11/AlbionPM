import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicComposition } from "@/components/public-composition";
import type { SharedComposition } from "@/lib/shared-composition";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Vista pública de una composición compartida. Sin login.
 *
 * Se resuelve con UNA llamada a `get_shared_composition`, que devuelve grupos,
 * personas, roles y builds ya armados. La página se abre desde un celular con
 * mala señal cinco minutos antes de una CTA: no hay margen para tres viajes al
 * servidor.
 */

async function cargar(slug: string): Promise<SharedComposition | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_composition", { p_slug: slug });

  if (error || !data) return null;
  return data as SharedComposition;
}

export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const composition = await cargar(slug);

  if (!composition) return { title: "Composición no encontrada — AlbionPM" };

  const personas = composition.groups.reduce(
    (total, group) =>
      total + group.slots.filter((s) => (s.player_name ?? "").trim() !== "").length,
    0,
  );

  return {
    title: `${composition.name} — AlbionPM`,
    description:
      composition.description ??
      `Composición de ${personas} jugadores en ${composition.groups.length} grupo(s).`,
    // Es un link que se comparte por Discord y WhatsApp, no algo que deba
    // terminar indexado en Google.
    robots: { index: false, follow: false },
  };
}

export default async function PublicSharePage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const composition = await cargar(slug);

  if (!composition) notFound();

  return <PublicComposition composition={composition} slug={slug} />;
}
