"use client";

import { LuminousModuleIcon, type LuminousModuleId } from "@/components/icons/LuminousModuleIcon";
import ThemeToggle from "@/components/ThemeToggle";

const modules: Array<{ id: LuminousModuleId; label: string }> = [
  { id: "academic", label: "Academic Hub" },
  { id: "projects", label: "Project Nexus" },
  { id: "communities", label: "Communities" },
  { id: "mentorship", label: "Mentorship" },
  { id: "careers", label: "Career & Opportunities" },
  { id: "university", label: "My University" },
  { id: "profile", label: "Unified Profile" },
  { id: "admissions", label: "Admissions" },
  { id: "administration", label: "Administration" },
];

export default function IconShowcasePage() {
  return (
    <main className="icon-showcase-page min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="surface-card px-5 py-5 sm:px-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--text-tertiary)" }}>One-Space / Icon System / Luminous Matte</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>Luminous Matte Icons</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Light and dark comparison of the reusable module identity system.</p>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          {(["light", "dark"] as const).map((theme) => (
            <div key={theme} data-theme={theme} className={`icon-showcase-theme icon-showcase-${theme}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{theme === "light" ? "Light mode" : "Dark mode"}</h2>
                <span className="ui-badge">Version 1</span>
              </div>
              <div className="icon-showcase-grid">
                {modules.map((module) => (
                  <article className="icon-showcase-card" key={module.id}>
                    <LuminousModuleIcon module={module.id} label={module.label} size={68} glow="standard" />
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{module.label}</h3>
                      <p className="mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>{module.id}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
