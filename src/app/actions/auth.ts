"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Registro, ingreso y salida con email y contraseña.
 *
 * Los errores se devuelven como texto para mostrarlos en el formulario, en vez
 * de lanzarse: un error de credenciales es un resultado esperable, no una
 * falla del sistema.
 */

export type AuthState = { error?: string; message?: string };

const MIN_PASSWORD = 8;

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Completá el correo y la contraseña." };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: traducirError(error.message) };
  }

  // Con la confirmación por correo activada, Supabase devuelve el usuario pero
  // sin sesión: no se puede entrar hasta hacer click en el mail.
  if (data.user && !data.session) {
    return {
      message: "Te mandamos un correo para confirmar la cuenta. Revisá tu bandeja.",
    };
  }

  redirect("/app");
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Completá el correo y la contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: traducirError(error.message) };
  }

  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Supabase devuelve los errores en inglés. Se traducen los frecuentes y el
 * resto se muestra tal cual: es preferible un mensaje en inglés a uno genérico
 * que no diga qué pasó.
 */
function traducirError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "Email not confirmed": "Todavía no confirmaste tu correo. Revisá tu bandeja.",
    "User already registered": "Ya existe una cuenta con ese correo.",
    "Password should be at least 6 characters":
      "La contraseña es demasiado corta.",
    "Unable to validate email address: invalid format":
      "Ese correo no tiene un formato válido.",
    "Email rate limit exceeded":
      "Se alcanzó el límite de correos por hora. Probá de nuevo más tarde.",
  };
  return map[message] ?? message;
}
