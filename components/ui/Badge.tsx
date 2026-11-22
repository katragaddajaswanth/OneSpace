import type { ReactNode } from "react";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "accent" }) {
  const tones = {
    neutral: { color: "var(--text-secondary)", background: "var(--surface-secondary)", borderColor: "var(--border)" },
    success: { color: "var(--success)", background: "var(--success-subtle)", borderColor: "transparent" },
    warning: { color: "var(--warning)", background: "var(--warning-subtle)", borderColor: "transparent" },
    danger: { color: "var(--danger)", background: "var(--danger-subtle)", borderColor: "transparent" },
    accent: { color: "var(--accent)", background: "var(--accent-subtle)", borderColor: "transparent" },
  };
  return <span className="ui-badge" style={tones[tone]}>{children}</span>;
}
