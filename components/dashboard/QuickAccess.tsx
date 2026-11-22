
import { quickAccessDestinations } from "@/components/layout/navigation";
import { ActionControl } from "@/components/ui/ActionControl";

export default function QuickAccess() {
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {quickAccessDestinations.map((module) => (
        <article
          key={module.href}
          className="surface-card surface-card-interactive spotlight-card tilt-card reveal-item group min-h-[150px] p-4"
        >
          <span className={`module-accent-dot module-accent-${module.number}`} aria-hidden="true" />
          <p className="text-xs font-semibold" style={{ color: "var(--text-tertiary)" }}>
            {module.number}
          </p>

          <p className="mt-2.5 text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
            {module.label}
          </p>

          <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
            {module.description}
          </p>

          <ActionControl href={module.href} variant="secondary" className="mt-4">Open module</ActionControl>
        </article>
      ))}
    </section>
  );
}
