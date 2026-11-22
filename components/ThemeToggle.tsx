"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("theme", theme);
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentTheme = document.documentElement.dataset.theme;
      setThemeState(currentTheme === "light" ? "light" : "dark");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    const applyTheme = () => {
      setTheme(nextTheme);
      setThemeState(nextTheme);
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewTransition = (document as Document & { startViewTransition?: (callback: () => void) => unknown }).startViewTransition;

    if (!reducedMotion && viewTransition) {
      try {
        viewTransition(applyTheme);
        return;
      } catch {
        // Fall through to the synchronous path if the browser rejects the transition.
      }
    }
    applyTheme();
  }

  return (
    <button
      type="button"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      aria-pressed={theme === "dark"}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      onClick={toggleTheme}
      className={`ui-button ui-button-secondary h-10 w-10 px-0 ${className}`.trim()}
    >
      <span aria-hidden="true" className="text-base">{theme === "dark" ? "☀" : "◐"}</span>
    </button>
  );
}
