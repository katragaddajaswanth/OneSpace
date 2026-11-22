
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CurrentUser {
  fullName: string;
}

export default function WelcomeBanner() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          router.replace("/login");
          return;
        }

        setUser(data.user);
      } catch {
        console.error("Unable to load user information.");
      }
    }

    loadUser();
  }, [router]);

  return (
    <section className="surface-card spotlight-card reveal-item welcome-banner px-5 py-6 sm:px-7 sm:py-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
            University ecosystem
          </p>
          <h2 className="mt-1.5 max-w-xl text-[28px] font-semibold leading-tight tracking-[-0.03em]" style={{ color: "var(--foreground)" }}>
            Welcome{user ? <>, <span className="welcome-name">{user.fullName}</span></> : ""}.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            Your academic journey, professional growth, projects and university community — connected in one place.
          </p>
        </div>
        <button className="ui-button ui-button-primary magnetic-button shrink-0">
          Explore One-Space
        </button>
      </div>
    </section>
  );
}
