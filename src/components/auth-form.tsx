"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn, signUp, type AuthState } from "@/app/actions/auth";

/**
 * Formulario de ingreso y de registro.
 *
 * Es el mismo componente para los dos casos: cambian el texto y la acción,
 * no la estructura. Mantenerlos separados solo duplicaría el mismo formulario
 * con dos títulos distintos.
 */

const EMPTY: AuthState = {};

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const isSignUp = mode === "signup";
  const [state, action, pending] = useActionState(
    isSignUp ? signUp : signIn,
    EMPTY,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vos@ejemplo.com"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-muted"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={isSignUp ? 8 : undefined}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text"
        />
        {isSignUp && (
          <p className="text-xs text-muted">Mínimo 8 caracteres.</p>
        )}
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      {state.message && (
        <p
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Un momento…" : isSignUp ? "Crear cuenta" : "Entrar"}
      </button>

      <p className="text-center text-sm text-muted">
        {isSignUp ? (
          <>
            ¿Ya tenés cuenta?{" "}
            <Link href="/entrar" className="text-accent underline underline-offset-4">
              Entrar
            </Link>
          </>
        ) : (
          <>
            ¿Todavía no tenés cuenta?{" "}
            <Link href="/registro" className="text-accent underline underline-offset-4">
              Crear una
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
