"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Historial de la calculadora, guardado en la base.
 *
 * Va a la base y no al navegador porque es trabajo del usuario: si sumaste el
 * loot de una CTA desde la computadora, lo tenés desde el celular.
 */

/** Cuántas operaciones se conservan por usuario. */
const LIMITE = 100;

export type EntradaHistorial = {
  id: string;
  expression: string;
  result: string;
  created_at: string;
};

export async function listCalcHistory(): Promise<EntradaHistorial[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calc_history")
    .select("id, expression, result, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMITE);

  return data ?? [];
}

export async function saveCalculation(
  expression: string,
  result: string,
): Promise<EntradaHistorial | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data } = await supabase
    .from("calc_history")
    .insert({ owner_id: userData.user.id, expression, result })
    .select("id, expression, result, created_at")
    .single();

  // Poda diferida: en vez de contar filas en cada cálculo, se borra lo viejo
  // de a poco. Sumar loot son muchas operaciones seguidas y no tiene sentido
  // pagar una consulta extra en cada una.
  if (Math.random() < 0.1) {
    const { data: viejas } = await supabase
      .from("calc_history")
      .select("id")
      .order("created_at", { ascending: false })
      .range(LIMITE, LIMITE + 200);

    const ids = (viejas ?? []).map((fila) => fila.id);
    if (ids.length > 0) {
      await supabase.from("calc_history").delete().in("id", ids);
    }
  }

  return data;
}

export async function clearCalcHistory(): Promise<void> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase.from("calc_history").delete().eq("owner_id", userData.user.id);
}
