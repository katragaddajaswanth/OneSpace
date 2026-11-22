"use client";

export function LuminousBrandIcon({ size = 36 }: { size?: number }) {
  return (
    <span
      className="luminous-brand-icon"
      role="img"
      aria-label="One-Space"
      style={{ width: size, height: size }}
    >
      <span className="luminous-brand-back" aria-hidden="true" />
      <span className="luminous-brand-o" aria-hidden="true">O</span>
    </span>
  );
}
