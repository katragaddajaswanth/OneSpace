"use client";

import { useEffect, useState } from "react";

export default function AnimatedCompletion({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, value));
    const start = performance.now();
    const duration = 850;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * displayValue) / 100;

  return (
    <div className="completion-ring" aria-label={`${displayValue}% profile complete`} role="img">
      <svg viewBox="0 0 76 76" aria-hidden="true">
        <defs>
          <linearGradient id="completion-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-blue)" />
            <stop offset="52%" stopColor="var(--accent-violet)" />
            <stop offset="100%" stopColor="var(--accent-pink)" />
          </linearGradient>
        </defs>
        <circle className="completion-ring-track" cx="38" cy="38" r={radius} />
        <circle className="completion-ring-value" cx="38" cy="38" r={radius} style={{ strokeDasharray: circumference, strokeDashoffset: dashOffset }} />
      </svg>
      <span>{displayValue}%</span>
    </div>
  );
}
