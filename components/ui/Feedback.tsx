export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="surface-card px-6 py-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}>—</div>
      <h3 className="mt-4 text-sm font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border p-4" role="alert" style={{ borderColor: "color-mix(in srgb, var(--danger) 30%, var(--border))", background: "var(--danger-subtle)", color: "var(--danger)" }}>
      <p className="text-sm">{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-3 text-sm font-bold underline">Retry</button>}
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return <div className="toast-notification" role="status" aria-live="polite"><span className="toast-check" aria-hidden="true">✓</span>{message}</div>;
}
