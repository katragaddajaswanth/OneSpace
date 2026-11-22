"use client";

import { useId } from "react";

export type LuminousModuleId =
  | "academic"
  | "projects"
  | "communities"
  | "mentorship"
  | "careers"
  | "university"
  | "profile"
  | "admissions"
  | "administration";

type LuminousModuleIconProps = {
  module: LuminousModuleId;
  label: string;
  size?: number;
  glow?: "subtle" | "standard" | "strong";
  className?: string;
};

export const luminousModuleLabels: Record<LuminousModuleId, string> = {
  academic: "Academic Hub",
  projects: "Project Nexus",
  communities: "Communities",
  mentorship: "Mentorship",
  careers: "Career & Opportunities",
  university: "My University",
  profile: "Unified Profile",
  admissions: "Admissions",
  administration: "Administration",
};

function IconGlyph({ module }: { module: LuminousModuleId }) {
  if (module === "academic") {
    return <><path d="M13 14.5c-3.7-2.2-7.2-1.8-9.2-.8v16c2.3-1.1 5.7-1.4 9.2.8V14.5Z" /><path d="M13 14.5c3.7-2.2 7.2-1.8 9.2-.8v16c-2.3-1.1-5.7-1.4-9.2.8V14.5Z" /><path d="M13 14.5v16" /></>;
  }
  if (module === "projects") {
    return <><path d="m13 4 9 5.2v10.6L13 25l-9-5.2V9.2L13 4Z" /><path d="m4 9.2 9 5.2 9-5.2M13 14.4V25" /><circle cx="13" cy="14.4" r="2.2" /></>;
  }
  if (module === "communities") {
    return <><circle cx="8.5" cy="11" r="3.5" /><circle cx="17.5" cy="11" r="3.5" /><circle cx="13" cy="18" r="3.7" /><path d="M4 21c.8-3.1 3.3-5 6.2-5M22 21c-.8-3.1-3.3-5-6.2-5" /></>;
  }
  if (module === "mentorship") {
    return <><path d="M13 22.5S5.5 18 5.5 11.8A4.3 4.3 0 0 1 13 9.2a4.3 4.3 0 0 1 7.5 2.6C20.5 18 13 22.5 13 22.5Z" /><path d="m9.4 14.8 2.4 2.3 4.5-5" /></>;
  }
  if (module === "careers") {
    return <><rect x="4" y="9" width="18" height="13" rx="2.5" /><path d="M9.5 9V7.5A2.5 2.5 0 0 1 12 5h2a2.5 2.5 0 0 1 2.5 2.5V9M4 14.5h18M11.5 13.5v3h3v-3" /></>;
  }
  if (module === "university") {
    return <><path d="m13 4 9 5v3H4V9l9-5ZM6 12v8M10 12v8M16 12v8M20 12v8M3.5 22h19" /></>;
  }
  if (module === "profile") {
    return <><circle cx="13" cy="9" r="4" /><path d="M5.5 23c.7-5.1 3.6-8 7.5-8s6.8 2.9 7.5 8" /><path d="M18 5.5l1.3 1.3 2.7-3" /></>;
  }
  if (module === "admissions") {
    return <><rect x="5" y="4" width="16" height="20" rx="3" /><path d="M9 9h8M9 13h8M9 17h5" /><path d="m16.5 18.5 1.5 1.5 3-3.5" /></>;
  }
  return <><path d="M13 3.5 21 7v5.5c0 5.2-3.2 8.7-8 10.5-4.8-1.8-8-5.3-8-10.5V7l8-3.5Z" /><path d="m9 13 2.5 2.5L17.5 9" /></>;
}

export function LuminousModuleIcon({ module, label, size = 56, glow = "standard", className = "" }: LuminousModuleIconProps) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const accessibleLabel = label || luminousModuleLabels[module];

  return (
    <span
      className={`luminous-module-icon luminous-${module} luminous-glow-${glow} ${className}`}
      role="img"
      aria-label={accessibleLabel}
      style={{ width: size, height: size }}
    >
      <span className="luminous-glass-back" aria-hidden="true" />
      <span className="luminous-glass-reflection" aria-hidden="true" />
      <svg
        aria-hidden="true"
        viewBox="0 0 26 26"
        width="60%"
        height="60%"
        fill="none"
        stroke={`url(#${id}-stroke)`}
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="luminous-glyph"
      >
        <defs>
          <linearGradient id={`${id}-stroke`} x1="4" y1="4" x2="21" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--glass-highlight)" />
            <stop offset=".48" stopColor="var(--glass-core)" />
            <stop offset="1" stopColor="var(--glass-core-2)" />
          </linearGradient>
        </defs>
        <IconGlyph module={module} />
      </svg>
    </span>
  );
}
