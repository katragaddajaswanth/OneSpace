"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type UniversityOverview = {
  university: { name: string; slug: string; website: string | null; emailDomain: string | null };
  statistics: { allMembers: number; students: number; faculty: number; alumni: number; departments: number; programs: number };
  departments: Array<{ id: string; name: string; code: string | null; studentCount: number; facultyCount: number; programs: Array<{ id: string; name: string }> }>;
};

export default function ProspectiveStudentDashboard() {
  const [overview, setOverview] = useState<UniversityOverview | null>(null);
  const [announcements, setAnnouncements] = useState<Array<{ id: string; content: string; moderatedAt: string | null }>>([]);
  const [communities, setCommunities] = useState<Array<{ id: string; name: string; category: string }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; title: string; category: string }>>([]);
  const [mentors, setMentors] = useState<Array<{ id: string; user: { fullName: string }; expertise: string[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/university", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/university/announcements", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/communities?limit=6", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/projects?limit=6", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/mentors?limit=6", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([university, official, communityData, projectData, mentorData]) => {
      if (!university.success) throw new Error(university.message);
      setOverview(university);
      setAnnouncements(official.announcements ?? []);
      setCommunities(communityData.communities ?? []);
      setProjects(projectData.projects ?? []);
      setMentors(mentorData.mentors ?? []);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Prospective dashboard could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="surface-card p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-tertiary)" }}>PROSPECTIVE STUDENT</p>
          <h1 className="mt-3 text-3xl font-bold" style={{ color: "var(--foreground)" }}>Welcome to your university journey</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "var(--text-secondary)" }}>Explore public university information, prepare your profile and discover campus communities before enrollment is verified.</p>
        </header>
        {error && <p role="alert" className="rounded-xl p-4 text-sm" style={{ background: "var(--danger-subtle)", color: "var(--danger)" }}>{error}</p>}
        {loading ? <p className="p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>Loading prospective student information…</p> : <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[["Departments", overview?.statistics.departments ?? 0], ["Programs", overview?.statistics.programs ?? 0], ["Faculty", overview?.statistics.faculty ?? 0], ["Alumni", overview?.statistics.alumni ?? 0]].map(([label, value]) => <div key={String(label)} className="surface-card p-5"><p className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</p><p className="mt-2 text-3xl font-bold" style={{ color: "var(--foreground)" }}>{value}</p></div>)}
          </section>
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="surface-card p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Departments</h2><Link href="/university?tab=departments" className="action-control action-control-tertiary">View all</Link></div><div className="mt-4 space-y-3">{overview?.departments.map((department) => <article key={department.id} className="rounded-xl p-4" style={{ background: "var(--surface-secondary)" }}><p className="font-semibold" style={{ color: "var(--foreground)" }}>{department.name}</p><p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{department.facultyCount} faculty · {department.programs.length} program(s)</p></article>)}</div></div>
            <div className="surface-card p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Official announcements</h2><Link href="/university?tab=announcements" className="action-control action-control-tertiary">View all</Link></div><div className="mt-4 space-y-3">{announcements.length ? announcements.slice(0, 4).map((announcement) => <article key={announcement.id} className="rounded-xl p-4" style={{ background: "var(--surface-secondary)" }}><p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{announcement.content}</p></article>) : <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No approved public announcements.</p>}</div></div>
          </section>
          <section className="grid gap-5 lg:grid-cols-3">
            <div className="surface-card p-6"><h2 className="font-bold">Public communities</h2><div className="mt-4 space-y-2">{communities.map((community) => <Link key={community.id} href="/communities" className="block rounded-xl p-3 text-sm font-semibold" style={{ background: "var(--surface-secondary)", color: "var(--foreground)" }}>{community.name}</Link>)}</div></div>
            <div className="surface-card p-6"><h2 className="font-bold">Public projects</h2><div className="mt-4 space-y-2">{projects.map((project) => <Link key={project.id} href="/projects" className="block rounded-xl p-3 text-sm font-semibold" style={{ background: "var(--surface-secondary)", color: "var(--foreground)" }}>{project.title}</Link>)}</div></div>
            <div className="surface-card p-6"><h2 className="font-bold">Eligible mentors</h2><div className="mt-4 space-y-2">{mentors.map((mentor) => <Link key={mentor.id} href="/mentorship" className="block rounded-xl p-3" style={{ background: "var(--surface-secondary)" }}><p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{mentor.user.fullName}</p><p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{mentor.expertise.join(", ")}</p></Link>)}</div></div>
          </section>
          <section className="surface-card flex flex-wrap items-center justify-between gap-4 p-6"><div><h2 className="font-bold" style={{ color: "var(--foreground)" }}>Complete your profile</h2><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Add intended academic interests, biography, skills and portfolio links.</p></div><Link href="/profile" className="ui-button ui-button-primary">Edit profile</Link></section>
        </>}
      </div>
    </main>
  );
}
