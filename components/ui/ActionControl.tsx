import type { ReactNode } from "react";
import Link from "next/link";

type ActionControlProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "tertiary";
  className?: string;
};

export function ActionControl({ href, children, variant = "secondary", className = "" }: ActionControlProps) {
  return (
    <Link href={href} className={`action-control action-control-${variant} ${className}`}>
      <span>{children}</span>
      <span className="action-control-arrow" aria-hidden="true">→</span>
    </Link>
  );
}
