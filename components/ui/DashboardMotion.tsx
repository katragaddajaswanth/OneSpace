"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function DashboardMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const updatePointer = (event: PointerEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>(".spotlight-card");
      if (!card || !root.contains(card)) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
      card.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);

      if (card.classList.contains("tilt-card") && event.pointerType !== "touch") {
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--tilt-x", `${(y * -6).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${(x * 6).toFixed(2)}deg`);
      }
    };

    const resetTilt = (event: PointerEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>(".tilt-card");
      if (card) {
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
      }
    };

    root.addEventListener("pointermove", updatePointer);
    root.addEventListener("pointerleave", resetTilt);
    return () => {
      root.removeEventListener("pointermove", updatePointer);
      root.removeEventListener("pointerleave", resetTilt);
    };
  }, []);

  return <div ref={rootRef} className="dashboard-motion">{children}</div>;
}
