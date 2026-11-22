
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  dashboardRouteDestinations,
  isActiveDestination,
  prospectiveStudentDestinations,
  workspaceDestinations,
} from "@/components/layout/navigation";
import { LuminousAvatar } from "@/components/icons/LuminousAvatar";
import { Skeleton } from "@/components/ui/Feedback";

const sidebarModuleIcons: Partial<Record<string, string>> = {
  "/profile": "profile",
  "/university": "university",
  "/academic-hub": "academic",
  "/projects": "projects",
  "/communities": "communities",
  "/mentorship": "mentorship",
  "/opportunities": "careers",
  "/admissions": "admissions",
  "/admin": "administration",
};

interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  institutionalId: string | null;
  primaryRole: string;
  photoUrl?: string | null;
  secondaryRoles?: string[];
  accountStatus: string;
  university: {
    name: string;
  } | null;
  department: {
    name: string;
    code: string | null;
  } | null;
  program: {
    name: string;
    code: string | null;
  } | null;
  studentProfile: {
    admissionYear: number | null;
    currentSemester: number | null;
    batch: string | null;
  } | null;
  facultyProfile: {
    designation: string | null;
    specialization: string | null;
    experienceYears: number | null;
  } | null;
}

export default function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

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
        console.error("Unable to load profile information.");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  const initials = user?.fullName
    ? user.fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : "...";

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 space-y-5">

        {/* Academic Profile Card */}
        <div className="surface-card p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Your Profile
          </p>

          <div className="flex items-center gap-3">
            <LuminousAvatar name={user?.fullName ?? initials} photoUrl={user?.photoUrl ?? null} size="md" />

            <div className="min-w-0">
              <p className="truncate text-sm font-bold" style={{ color: "var(--foreground)" }}>
                {loading ? <Skeleton className="h-4 w-28" /> : user?.fullName || "Profile unavailable"}
              </p>

              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {user?.primaryRole?.replaceAll("_", " ") || ""}
              </p>
            </div>
          </div>

          {user && (
            <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  University
                </p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {user.university?.name || "Not assigned"}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Department
                </p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {user.department?.name || "Not assigned"}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Program
                </p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {user.program?.name || "Not assigned"}
                </p>
              </div>

              {user.primaryRole === "STUDENT" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Current Semester
                  </p>
                  <p className="mt-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {user.studentProfile?.currentSemester
                      ? `Semester ${user.studentProfile.currentSemester}`
                      : "Not available"}
                  </p>
                </div>
              )}

              {user.primaryRole === "FACULTY" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Designation
                  </p>
                  <p className="mt-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {user.facultyProfile?.designation || "Not available"}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Institutional ID
                </p>
                <p className="mt-1 break-all text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {user.institutionalId || "Not assigned"}
                </p>
              </div>

              <span className="ui-badge account-status" style={{ background: "transparent", color: "var(--text-secondary)", borderColor: "var(--border)" }}>
                <span className="status-dot" aria-hidden="true" />
                {user.accountStatus.replaceAll("_", " ")}
              </span>
            </div>
          )}

          <Link href="/profile" className="action-control action-control-secondary mt-4 block w-full"><span>View profile</span><span className="action-control-arrow">→</span></Link>
        </div>

        {/* Workspace Navigation */}
        <div className="surface-card p-3.5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Workspace
          </p>

          <nav className="space-y-1">
            {(user?.primaryRole === "PROSPECTIVE_STUDENT" ? prospectiveStudentDestinations : workspaceDestinations).map((item) => {
              const active = item.href ? isActiveDestination(pathname, item.href) : false;
              const className = `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                active ? "" : item.href ? "" : "cursor-not-allowed"
              }`;
              const navigationStyle = { color: active ? "var(--foreground)" : "var(--text-secondary)" };

              return item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${className} px-2.5 py-2`}
                  style={navigationStyle}
                >
                  {sidebarModuleIcons[item.href] ? (
                    <span className={`sidebar-accent-dot sidebar-accent-${sidebarModuleIcons[item.href]}`} aria-hidden="true" />
                  ) : (
                    <span className="w-5 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>{item.label === "Dashboard" ? "⌂" : "·"}</span>
                  )}
                  <span>{item.label}</span>
                </Link>
              ) : null;
            })}
            {user?.secondaryRoles?.includes("ADMINISTRATOR") && (
              <Link href="/admin" aria-current={isActiveDestination(pathname, "/admin") ? "page" : undefined} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition" style={{ color: isActiveDestination(pathname, "/admin") ? "var(--foreground)" : "var(--text-secondary)" }}>
                <span className="sidebar-accent-dot sidebar-accent-administration" aria-hidden="true" />Administrator
              </Link>
            )}
            {user?.secondaryRoles?.some((role) => role === "PROCTOR" || role === "PROJECT_ANALYSIS_CREW") && (
              <Link href="/review" aria-current={isActiveDestination(pathname, "/review") ? "page" : undefined} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition" style={{ color: isActiveDestination(pathname, "/review") ? "var(--foreground)" : "var(--text-secondary)" }}>
                <span className="sidebar-accent-dot sidebar-accent-projects" aria-hidden="true" />Review Workspace
              </Link>
            )}
          </nav>
        </div>

        {/* University Community */}
        <div className="surface-card p-5">
          <p className="text-sm font-semibold">
            Your university space
          </p>

          <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
            Connect with people, discover opportunities and build
            meaningful projects within your university.
          </p>

          <Link href={dashboardRouteDestinations.communities} className="action-control action-control-secondary mt-4 block w-full">
            <span>Explore community</span><span className="action-control-arrow">→</span>
          </Link>
        </div>

      </div>
    </aside>
  );
}
