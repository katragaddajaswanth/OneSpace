
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardRouteDestinations } from "@/components/layout/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { LuminousBrandIcon } from "@/components/icons/LuminousBrandIcon";
import { LuminousAvatar } from "@/components/icons/LuminousAvatar";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { Skeleton } from "@/components/ui/Feedback";

interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  primaryRole: string;
  photoUrl?: string | null;
}

export default function AppHeader() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

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

        const profileResponse = await fetch("/api/profile", { credentials: "same-origin", cache: "no-store" });
        const profileData = profileResponse.ok ? await profileResponse.json() : null;
        setUser({ ...data.user, photoUrl: profileData?.profile?.photoUrl ?? null });
      } catch {
        setError("Unable to load your profile.");
      }
    }

    loadUser();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Logout failed. Please try again.");
        setLoggingOut(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <>
    <header className={`app-header sticky top-0 z-30 border-b backdrop-blur ${scrolled ? "is-scrolled" : ""}`} style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 82%, transparent)" }}>
      <div className="mx-auto grid h-[68px] max-w-[1500px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 md:grid-cols-[minmax(160px,220px)_1fr_auto] lg:px-6">

        {/* Brand */}
        <Link href={dashboardRouteDestinations.home} aria-label="One-Space dashboard" className="flex items-center gap-3">
          <LuminousBrandIcon size={36} />

          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">
              One-Space
            </h1>
            <p className="text-[9px] tracking-[0.16em]" style={{ color: "var(--text-tertiary)" }}>
              YOUR UNIVERSITY. CONNECTED.
            </p>
          </div>
        </Link>

        {/* Search */}
        <form className="hidden w-full max-w-[420px] px-6 md:block" onSubmit={(event) => { event.preventDefault(); setPaletteOpen(true); }}>
          <input
            type="search"
            readOnly
            onFocus={() => setPaletteOpen(true)}
            placeholder="Search people, projects, skills..."
            className="form-input command-search-trigger"
            aria-label="Open search"
          />
          <kbd className="command-search-shortcut">⌘ K</kbd>
        </form>

        {/* User actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LuminousAvatar name={user?.fullName ?? ""} photoUrl={user?.photoUrl ?? null} size="sm" />

          <div className="hidden sm:block">
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {user?.fullName || <Skeleton className="h-4 w-24" />}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {user?.primaryRole?.replaceAll("_", " ") || ""}
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((value) => !value)}
              className="ui-button ui-button-secondary h-9 w-9 px-0"
              aria-label="Account menu"
            >
              <span aria-hidden="true">•••</span>
            </button>
            {accountOpen && (
              <div role="menu" className="surface-card absolute right-0 top-11 w-48 p-1.5" style={{ boxShadow: "var(--shadow-lg)" }}>
                <Link href="/profile" role="menuitem" onClick={() => setAccountOpen(false)} className="block rounded-[7px] px-3 py-2 text-sm" style={{ color: "var(--foreground)" }}>View profile</Link>
                <button role="menuitem" onClick={handleLogout} disabled={loggingOut} className="block w-full rounded-[7px] px-3 py-2 text-left text-sm" style={{ color: "var(--danger)" }}>
                  {loggingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <nav aria-label="Mobile navigation" className="flex items-center gap-1 overflow-x-auto border-t px-3 py-2 lg:hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {[["Dashboard", "/"], ["University", "/university"], ["Projects", "/projects"], ["Communities", "/communities"], ["Discover", "/opportunities"]].map(([label, href]) => (
          <Link key={href} href={href} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</Link>
        ))}
      </nav>

      {error && (
        <p className="border-t px-5 py-2 text-center text-xs" style={{ borderColor: "var(--border)", background: "var(--danger-subtle)", color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </header>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
