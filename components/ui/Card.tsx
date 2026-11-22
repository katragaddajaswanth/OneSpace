import type { HTMLAttributes, ReactNode } from "react";

export function Card({ children, interactive = false, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode; interactive?: boolean }) {
  return <div className={`surface-card ${interactive ? "surface-card-interactive" : ""} ${className}`} {...props}>{children}</div>;
}
