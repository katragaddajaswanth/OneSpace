import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "primary", loading, icon, children, className = "", disabled, ...props }: ButtonProps) {
  const variants = {
    primary: "ui-button-primary",
    secondary: "ui-button-secondary",
    ghost: "",
    danger: "",
  };
  const style = variant === "danger"
    ? { borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-subtle)" }
    : variant === "ghost"
      ? { color: "var(--text-secondary)", background: "transparent" }
      : undefined;
  return (
    <button disabled={disabled || loading} className={`ui-button ${variants[variant]} ${variant === "ghost" ? "hover:surface-secondary" : ""} ${className}`} style={style} {...props}>
      {loading && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {!loading && icon}
      {children}
    </button>
  );
}
