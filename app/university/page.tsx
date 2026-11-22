"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Department = { id: string; name: string; code: string | null; description: null; facultyCount: number; studentCount: number; programs: Array<{ id: string; name: string; code: string | null }> };
type Member = { id: string; fullName: string; primaryRole: string; institutionalId: string | null; department: { id: string; name: string } | null; program: { id: string; name: string } | null; photoUrl: string | null; skills: string[]; verifiedSkills: string[]; verifiedCertificationCount: number; profileVisibility: string };
type Announcement = { id: string; content: string; attachments: string[]; moderatedAt: string | null; createdAt: string; author: { id: string; fullName: string; primaryRole: string } };
type UniversityData = { university: { id: string; name: string; slug: string; emailDomain: string | null; website: string | null; isActive: boolean }; statistics: { allMembers: number; students: number; faculty: number; alumni: number; departments: number; programs: number }; departments: Department[]; members: Member[]; pagination: { page: number; limit: number; total: number; totalPages: number }; basicInfoUnavailable: string };

export default function UniversityPage() {
  const [data, setData] = useState<UniversityData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [user, setUser] = useState<{ primaryRole: string; secondaryRoles: string[] } | null>(null);
  const [tab, setTab] = useState<"overview" | "people" | "departments" | "announcements">("overview");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [skill, setSkill] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [announcementText, setAnnouncementText] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "24" });
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (departmentId) params.set("departmentId", departmentId);
      if (programId) params.set("programId", programId);
      if (skill.trim()) params.set("skill", skill.trim());
      const [universityResponse, announcementResponse, meResponse] = await Promise.all([
        fetch(`/api/university?${params}`, { cache: "no-store" }),
        fetch("/api/university/announcements", { cache: "no-store" }),
        fetch("/api/auth/me", { cache: "no-store" }),
      ]);
      const [universityData, announcementData, meData] = await Promise.all([universityResponse.json(), announcementResponse.json(), meResponse.json()]);
      if (!universityResponse.ok) throw new Error(universityData.message ?? "University data could not be loaded.");
      if (!announcementResponse.ok) throw new Error(announcementData.message ?? "Announcements could not be loaded.");
      setData(universityData); setAnnouncements(announcementData.announcements ?? []);
      setUser(meData.user ? { primaryRole: meData.user.primaryRole, secondaryRoles: meData.user.secondaryRoles ?? [] } : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "University data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [search, role, departmentId, programId, skill, page]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);

  const canPublish = user?.secondaryRoles.some((item) => item === "ADMINISTRATOR" || item === "PROCTOR");

  async function submitAnnouncement(event: FormEvent) {
    event.preventDefault();
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/university/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: announcementText }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Announcement could not be submitted.");
      setAnnouncementText("");
      setNotice(body.message ?? "Announcement submitted.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Announcement could not be submitted.");
    }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
    <div className="mx-auto max-w-7xl space-y-7">
      <Link href="/" className="text-sm font-semibold text-blue-700">← Dashboard</Link>
      <header className="surface-card relative overflow-hidden px-6 py-7 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">        One-Space / University Network</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{data?.university.name ?? "My University"}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">Explore university members, academic programs, departments and official updates within your authenticated university.</p>
      </header>
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={() => void load()} className="ml-3 font-bold underline">Retry</button></div>}
      <nav className="flex flex-wrap gap-5 border-b border-slate-200">
        {([["overview", "Overview"], ["people", "People"], ["departments", "Departments"], ["announcements", "Announcements"]] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`border-b-2 pb-3 text-sm font-semibold ${tab === key ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500"}`}>{label}</button>)}
      </nav>
      {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading university network…</p> : data && <>
        {tab === "overview" && <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[["University members", data.statistics.allMembers], ["Students", data.statistics.students], ["Faculty", data.statistics.faculty], ["Alumni", data.statistics.alumni], ["Departments", data.statistics.departments], ["Academic programs", data.statistics.programs]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value}</p></div>)}
          </section>
          <section className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
            <div className="rounded-2xl border bg-white p-6"><h2 className="text-lg font-bold">University identity</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Name</dt><dd className="mt-1 font-semibold">{data.university.name}</dd></div><div><dt className="text-xs text-slate-500">University slug</dt><dd className="mt-1 font-semibold">{data.university.slug}</dd></div><div><dt className="text-xs text-slate-500">Email domain</dt><dd className="mt-1 font-semibold">{data.university.emailDomain ?? "Not recorded"}</dd></div><div><dt className="text-xs text-slate-500">Website</dt><dd className="mt-1 font-semibold">{data.university.website ?? "Not recorded"}</dd></div></dl><p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{data.basicInfoUnavailable}</p></div>
            <div className="rounded-2xl border bg-white p-6"><h2 className="text-lg font-bold">Campus discovery</h2><div className="mt-4 grid gap-3"><Link href="/communities" className="rounded-xl bg-slate-50 p-4 text-sm font-semibold hover:bg-blue-50">Communities and clubs →</Link><Link href="/projects" className="rounded-xl bg-slate-50 p-4 text-sm font-semibold hover:bg-blue-50">Project Nexus →</Link><Link href="/mentorship" className="rounded-xl bg-slate-50 p-4 text-sm font-semibold hover:bg-blue-50">Mentorship →</Link><Link href="/opportunities" className="rounded-xl bg-slate-50 p-4 text-sm font-semibold hover:bg-blue-50">Career & Opportunities →</Link><Link href="/academic-hub" className="rounded-xl bg-slate-50 p-4 text-sm font-semibold hover:bg-blue-50">Academic Hub →</Link></div></div>
          </section>
        </>}
        {tab === "people" && <>
          <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-5">
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name or ID…" className="rounded-xl border px-4 py-3 text-sm md:col-span-2" />
            <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className="rounded-xl border px-3 py-3 text-sm"><option value="">All roles</option><option value="STUDENT">Students</option><option value="FACULTY">Faculty</option><option value="ALUMNI">Alumni</option><option value="INDUSTRY_REPRESENTATIVE">Industry representatives</option></select>
            <select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }} className="rounded-xl border px-3 py-3 text-sm"><option value="">All departments</option>{data.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
            <input value={skill} onChange={(event) => { setSkill(event.target.value); setPage(1); }} placeholder="Skill…" className="rounded-xl border px-4 py-3 text-sm" />
            <select value={programId} onChange={(event) => { setProgramId(event.target.value); setPage(1); }} className="rounded-xl border px-3 py-3 text-sm md:col-start-4"><option value="">All programs</option>{data.departments.flatMap((department) => department.programs).map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select>
          </section>
          {data.members.length === 0 ? <p className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">No visible university members match these filters.</p> : <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.members.map((member) => <Link key={member.id} href={`/profiles/${encodeURIComponent(member.id)}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-lg font-bold text-blue-800">{member.photoUrl ? <img src={member.photoUrl} alt="" className="h-full w-full object-cover" /> : member.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</div><div><h2 className="font-bold text-slate-900">{member.fullName}</h2><p className="text-xs text-slate-500">{member.primaryRole.replaceAll("_", " ")} · {member.department?.name ?? "Department not assigned"}</p></div></div><p className="mt-4 text-xs text-slate-500">{member.program?.name ?? "Program not assigned"}</p><div className="mt-3 flex min-h-7 flex-wrap gap-2">{member.skills.slice(0, 5).map((item) => <span key={item} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{item}</span>)}{member.verifiedCertificationCount > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">{member.verifiedCertificationCount} verified certification{member.verifiedCertificationCount === 1 ? "" : "s"}</span>}</div></Link>)}</section>}
          {data.pagination.totalPages > 1 && <div className="flex items-center justify-between"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-xs text-slate-500">Page {page} of {data.pagination.totalPages}</span><button disabled={page >= data.pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Next</button></div>}
        </>}
        {tab === "departments" && <section className="grid gap-5 md:grid-cols-2">{data.departments.map((department) => <article key={department.id} className="rounded-2xl border bg-white p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{department.name}</h2><p className="mt-1 text-xs text-slate-500">{department.code ?? "Department code not recorded"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{department.facultyCount} faculty · {department.studentCount} students</span></div><p className="mt-5 text-sm text-slate-500">Academic programs</p>{department.programs.length ? <div className="mt-2 flex flex-wrap gap-2">{department.programs.map((program) => <span key={program.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">{program.name}{program.code ? ` · ${program.code}` : ""}</span>)}</div> : <p className="mt-2 text-sm text-slate-500">No academic programs recorded.</p>}</article>)}</section>}
        {tab === "announcements" && <section className="space-y-5">{canPublish && <form onSubmit={submitAnnouncement} className="rounded-2xl border bg-white p-6"><h2 className="font-bold">Publish an official announcement</h2><p className="mt-1 text-xs text-slate-500">Authorized announcements enter the existing post moderation queue.</p><textarea required maxLength={5000} value={announcementText} onChange={(event) => setAnnouncementText(event.target.value)} rows={4} placeholder="Write an official university announcement…" className="mt-4 w-full rounded-xl border p-3 text-sm" /><button className="mt-3 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white">Submit for moderation</button></form>}<div className="space-y-3">{announcements.length ? announcements.map((announcement) => <article key={announcement.id} className="rounded-2xl border bg-white p-6"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Official announcement</span><time className="text-xs text-slate-400">{new Date(announcement.moderatedAt ?? announcement.createdAt).toLocaleString()}</time></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{announcement.content}</p><p className="mt-3 text-xs text-slate-500">Published by {announcement.author.fullName}</p></article>) : <p className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">No approved official university announcements.</p>}</div></section>}
      </>}
    </div>
  </main>;
}
