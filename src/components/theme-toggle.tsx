"use client";

import { useState, useTransition } from "react";

import { setTheme } from "@/app/actions/theme";
import { themeAttribute, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Claro", icon: "☀" },
  { value: "dark", label: "Oscuro", icon: "☾" },
  { value: "system", label: "Sistema", icon: "🖳" },
];

/**
 * Selector de tema.
 *
 * El cambio es optimista: se aplica al `<html>` en el mismo instante del click
 * y se sincroniza en segundo plano. Esperar al servidor para repintar haría que
 * algo tan inmediato como cambiar de tema se sintiera lento.
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setLocalTheme] = useState<Theme>(initial);
  const [, startTransition] = useTransition();

  function choose(next: Theme) {
    setLocalTheme(next);

    // Misma lógica que usa el servidor: sin atributo, manda el sistema.
    const attribute = themeAttribute(next);
    if (attribute) {
      document.documentElement.dataset.theme = attribute;
    } else {
      delete document.documentElement.dataset.theme;
    }

    startTransition(() => {
      void setTheme(next);
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la interfaz"
      className="inline-flex rounded-lg border border-border bg-surface p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.label}
            onClick={() => choose(option.value)}
            className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
              active
                ? "bg-accent text-accent-fg"
                : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            <span aria-hidden>{option.icon}</span>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
