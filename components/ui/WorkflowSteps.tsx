"use client";

import type { ReactNode } from "react";

export type WorkflowStepState = "completed" | "active" | "pending";

export function WorkflowSteps({
  steps,
}: {
  steps: Array<{ id: string; title: string; description: string; state: WorkflowStepState; detail?: ReactNode }>;
}) {
  return (
    <ol className="divide-y" style={{ borderColor: "var(--border)" }}>
      {steps.map((step, index) => (
        <li
          key={step.id}
          className="py-4 first:pt-0 last:pb-0"
          aria-current={step.state === "active" ? "step" : undefined}
        >
          <div className="flex gap-3">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all"
              style={
                step.state === "completed"
                  ? { borderColor: "var(--success)", background: "var(--success-subtle)", color: "var(--success)" }
                  : step.state === "active"
                    ? { borderColor: "var(--accent)", background: "var(--accent-subtle)", color: "var(--accent)" }
                    : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-tertiary)" }
              }
              aria-label={step.state}
            >
              {step.state === "completed" ? "✓" : index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{step.title}</h3>
                <span className="text-[11px] font-medium" style={{ color: step.state === "active" ? "var(--accent)" : "var(--text-tertiary)" }}>
                  {step.state === "completed" ? "Completed" : step.state === "active" ? "In progress" : "Pending"}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-5" style={{ color: "var(--text-secondary)" }}>{step.description}</p>
              {step.state === "active" && step.detail && (
                <div className="mt-3 overflow-hidden animate-[page-enter_240ms_var(--ease-standard)_both]">{step.detail}</div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
