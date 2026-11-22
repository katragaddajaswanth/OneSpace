"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Profile = { bio: string; photoUrl: string | null; coverUrl: string | null; skills: string[]; interests: string[]; portfolioUrl: string | null; linkedinUrl: string | null; githubUrl: string | null; visibility: "PRIVATE" | "UNIVERSITY" | "PUBLIC"; identity?: { fullName: string; institutionalId: string | null; primaryRole: string; university: { name: string } | null; department: { id: string; name: string } | null; program: { id: string; name: string } | null; studentProfile: { currentSemester: number | null; batch: string | null } | null }; experiences: Array<{ id: string; organization: string; title: string; description: string; startedAt: string | null; endedAt: string | null }>; certifications: Array<{ id: string; title: string; issuer: string; status: string }> };
type PendingCorrection = { id: string; field: string; proposedValue: string; status: string; reason: string | null };
type Skill = { id: string; skill: string; status: string };
type Achievement = { id: string; type: string; title: string; description: string; url: string | null };
const emptyProfile: Profile = { bio: "", photoUrl: null, coverUrl: null, skills: [], interests: [], portfolioUrl: null, linkedinUrl: null, githubUrl: null, visibility: "UNIVERSITY", experiences: [], certifications: [] };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [interestsText, setInterestsText] = useState("");
  const [corrections, setCorrections] = useState<PendingCorrection[]>([]); const [skills, setSkills] = useState<Skill[]>([]); const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [intendedDepartments, setIntendedDepartments] = useState<Array<{ id: string; name: string; programs: Array<{ id: string; name: string }> }>>([]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [profileResponse, userResponse, correctionResponse, skillsResponse, achievementsResponse] = await Promise.all([fetch("/api/profile", { cache: "no-store" }), fetch("/api/auth/me", { cache: "no-store" }), fetch("/api/profile/corrections", { cache: "no-store" }), fetch("/api/profile/skills", { cache: "no-store" }), fetch("/api/profile/achievements", { cache: "no-store" })]);
      if (userResponse.status === 401) { window.location.assign("/login"); return; }
      if (!profileResponse.ok) throw new Error("Profile could not be loaded.");
      const data = await profileResponse.json();
      const value = { ...emptyProfile, ...(data.profile ?? {}) } as Profile;
      setProfile(value); setSkillsText(value.skills.join(", ")); setInterestsText(value.interests.join(", "));
      const correctionsData = await correctionResponse.json(); const skillsData = await skillsResponse.json(); const achievementsData = await achievementsResponse.json();
      if (correctionResponse.ok) setCorrections(correctionsData.corrections ?? []); if (skillsResponse.ok) setSkills(skillsData.verifications ?? []); if (achievementsResponse.ok) setAchievements(achievementsData.achievements ?? []);
      if (data.profile?.identity?.primaryRole === "PROSPECTIVE_STUDENT") {
        void fetch("/api/university-registration-options", { cache: "no-store" }).then((response) => response.json()).then((options) => setIntendedDepartments(options.departments ?? [])).catch(() => setIntendedDepartments([]));
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Profile could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: profile.bio,
          photoUrl: profile.photoUrl,
          coverUrl: profile.coverUrl,
          portfolioUrl: profile.portfolioUrl,
          linkedinUrl: profile.linkedinUrl,
          githubUrl: profile.githubUrl,
          visibility: profile.visibility,
          skills: skillsText.split(",").map((v) => v.trim()).filter(Boolean),
          interests: interestsText.split(",").map((v) => v.trim()).filter(Boolean),
          ...(profile.identity?.primaryRole === "PROSPECTIVE_STUDENT"
            ? { departmentId: profile.identity.department?.id ?? null, programId: profile.identity.program?.id ?? null }
            : {}),
        }),
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Profile could not be saved.");
      setProfile((current) => ({ ...current, ...data.profile })); setNotice("Profile saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Profile could not be saved."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8 text-sm text-slate-500">Loading profile…</main>;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8"><div className="mx-auto max-w-5xl space-y-6">
    <Link href="/" className="text-sm font-semibold text-blue-700">← Dashboard</Link>
    <header><p className="text-xs font-bold uppercase tracking-widest text-blue-700">    One-Space / Profile</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Your university profile</h1><p className="mt-2 text-sm text-slate-500">Academic identity is maintained by the university. You can edit the personal profile fields below.</p></header>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={() => void load()} className="ml-3 font-bold underline">Retry</button></div>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {profile.identity && <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-bold">Academic identity</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div><p className="text-xs text-slate-500">Name</p><p className="mt-1 text-sm font-semibold">{profile.identity.fullName}</p></div><div><p className="text-xs text-slate-500">Institutional ID</p><p className="mt-1 text-sm font-semibold">{profile.identity.institutionalId ?? "Unavailable"}</p></div><div><p className="text-xs text-slate-500">University</p><p className="mt-1 text-sm font-semibold">{profile.identity.university?.name ?? "Unavailable"}</p></div><div><p className="text-xs text-slate-500">Department</p><p className="mt-1 text-sm font-semibold">{profile.identity.department?.name ?? "Unavailable"}</p></div><div><p className="text-xs text-slate-500">Program</p><p className="mt-1 text-sm font-semibold">{profile.identity.program?.name ?? "Unavailable"}</p></div><div><p className="text-xs text-slate-500">Semester</p><p className="mt-1 text-sm font-semibold">{profile.identity.studentProfile?.currentSemester ? `Semester ${profile.identity.studentProfile.currentSemester}` : "Unavailable"}</p></div></div></section>}
    <form onSubmit={save} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Profile photo URL<input value={profile.photoUrl ?? ""} onChange={(e) => setProfile({ ...profile, photoUrl: e.target.value || null })} className="mt-2 w-full rounded-xl border p-3" placeholder="https://…" /></label>
        <label className="text-sm font-medium text-slate-700">Cover image URL<input value={profile.coverUrl ?? ""} onChange={(e) => setProfile({ ...profile, coverUrl: e.target.value || null })} className="mt-2 w-full rounded-xl border p-3" placeholder="https://…" /></label>
      </div>
      <label className="block text-sm font-medium text-slate-700">About you<textarea value={profile.bio} maxLength={3000} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={5} className="mt-2 w-full rounded-xl border p-3" /></label>
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Skills, comma separated<input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label><label className="text-sm font-medium text-slate-700">Interests, comma separated<input value={interestsText} onChange={(e) => setInterestsText(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label></div>
      {profile.identity?.primaryRole === "PROSPECTIVE_STUDENT" && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="text-sm font-bold text-amber-950">Intended academic information</h2><p className="mt-1 text-xs text-amber-800">These choices are not verified enrollment records.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Intended department<select value={profile.identity.department?.id ?? ""} onChange={(event) => setProfile({ ...profile, identity: profile.identity ? { ...profile.identity, department: event.target.value ? { id: event.target.value, name: intendedDepartments.find((department) => department.id === event.target.value)?.name ?? "Selected department" } : null, program: null } : profile.identity })} className="mt-2 w-full rounded-xl border p-3"><option value="">Not selected</option>{intendedDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Intended program<select value={profile.identity.program?.id ?? ""} onChange={(event) => setProfile({ ...profile, identity: profile.identity ? { ...profile.identity, program: event.target.value ? { id: event.target.value, name: intendedDepartments.flatMap((department) => department.programs).find((program) => program.id === event.target.value)?.name ?? "Selected program" } : null } : profile.identity })} className="mt-2 w-full rounded-xl border p-3"><option value="">Not selected</option>{intendedDepartments.find((department) => department.id === profile.identity?.department?.id)?.programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label></div></section>}
      <div className="grid gap-4 md:grid-cols-3">{(["portfolioUrl", "linkedinUrl", "githubUrl"] as const).map((field) => <label key={field} className="text-sm font-medium capitalize text-slate-700">{field.replace("Url", " URL")}<input value={profile[field] ?? ""} onChange={(e) => setProfile({ ...profile, [field]: e.target.value || null })} className="mt-2 w-full rounded-xl border p-3" placeholder="https://…" /></label>)}</div>
      <label className="block text-sm font-medium text-slate-700">Profile visibility<select value={profile.visibility} onChange={(e) => setProfile({ ...profile, visibility: e.target.value as Profile["visibility"] })} className="mt-2 rounded-xl border p-3"><option value="PRIVATE">Private</option><option value="UNIVERSITY">University</option><option value="PUBLIC">Public</option></select></label>
      <button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button>
    </form>
    <section className="grid gap-6 md:grid-cols-2"><div className="rounded-2xl border bg-white p-6"><h2 className="font-bold">Experience</h2>{profile.experiences.length ? profile.experiences.map((item) => <p key={item.id} className="mt-3 text-sm"><b>{item.title}</b> · {item.organization}</p>) : <p className="mt-3 text-sm text-slate-500">No experience added yet.</p>}<ExperienceForm onSaved={() => void load()} /></div><div className="rounded-2xl border bg-white p-6"><h2 className="font-bold">Certifications</h2>{profile.certifications.length ? profile.certifications.map((item) => <p key={item.id} className="mt-3 text-sm"><b>{item.title}</b> · {item.issuer} <span className="text-xs text-slate-500">({item.status})</span></p>) : <p className="mt-3 text-sm text-slate-500">No certifications added yet.</p>}<CertificationForm onSaved={() => void load()} /></div>
      <div className="rounded-2xl border bg-white p-6"><h2 className="font-bold">Skill verification</h2>{skills.map((item) => <p key={item.id} className="mt-2 text-sm">{item.skill} <span className="text-xs text-slate-500">· {item.status}</span></p>)}{!skills.length && <p className="mt-2 text-sm text-slate-500">No skills submitted for verification.</p>}<SkillForm onSaved={() => void load()} /></div>
      <div className="rounded-2xl border bg-white p-6"><h2 className="font-bold">Projects and achievements</h2>{achievements.map((item) => <p key={item.id} className="mt-2 text-sm"><b>{item.title}</b> · {item.type}</p>)}{!achievements.length && <p className="mt-2 text-sm text-slate-500">No portfolio items yet.</p>}<AchievementForm onSaved={() => void load()} /></div>
    </section>
    <section className="rounded-2xl border bg-white p-6"><h2 className="font-bold">Academic profile correction requests</h2><p className="mt-1 text-sm text-slate-500">Sensitive university fields require Administrator review.</p>{corrections.map((item) => <p key={item.id} className="mt-3 text-sm">{item.field}: {item.proposedValue} <span className="text-xs text-slate-500">· {item.status}{item.reason ? ` · ${item.reason}` : ""}</span></p>)}<CorrectionForm onSaved={() => void load()} /></section>
  </div></main>;
}

function ExperienceForm({ onSaved }: { onSaved: () => void }) {
  const [organization, setOrganization] = useState(""); const [title, setTitle] = useState(""); const [message, setMessage] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/profile/experiences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organization, title }) }); const data = await response.json(); if (!response.ok) { setMessage(data.message ?? "Could not add experience."); return; } setOrganization(""); setTitle(""); setMessage("Experience added."); onSaved(); }
  return <form onSubmit={submit} className="mt-5 space-y-2 border-t pt-4"><input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Role or title" className="w-full rounded-lg border p-2 text-sm" /><input required maxLength={200} value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Organization" className="w-full rounded-lg border p-2 text-sm" /><button className="text-sm font-semibold text-blue-700">Add experience</button>{message && <p role="status" className="text-xs text-slate-500">{message}</p>}</form>;
}

function CertificationForm({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState(""); const [issuer, setIssuer] = useState(""); const [message, setMessage] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/profile/certifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, issuer }) }); const data = await response.json(); if (!response.ok) { setMessage(data.message ?? "Could not add certification."); return; } setTitle(""); setIssuer(""); setMessage("Certification submitted for verification."); onSaved(); }
  return <form onSubmit={submit} className="mt-5 space-y-2 border-t pt-4"><input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Certification" className="w-full rounded-lg border p-2 text-sm" /><input required maxLength={200} value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Issuer" className="w-full rounded-lg border p-2 text-sm" /><button className="text-sm font-semibold text-blue-700">Add certification</button>{message && <p role="status" className="text-xs text-slate-500">{message}</p>}</form>;
}

function SkillForm({ onSaved }: { onSaved: () => void }) { const [skill, setSkill] = useState(""); const [message, setMessage] = useState(""); async function submit(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/profile/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skill }) }); const data = await response.json(); if (!response.ok) { setMessage(data.message ?? "Could not submit skill."); return; } setSkill(""); setMessage("Skill sent for verification; it is not verified yet."); onSaved(); } return <form onSubmit={submit} className="mt-4 flex gap-2 border-t pt-4"><input required maxLength={80} value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Skill to verify" className="min-w-0 flex-1 rounded-lg border p-2 text-sm" /><button className="text-sm font-semibold text-blue-700">Submit</button>{message && <span role="status" className="sr-only">{message}</span>}</form>; }

function AchievementForm({ onSaved }: { onSaved: () => void }) { const [title, setTitle] = useState(""); const [type, setType] = useState("ACHIEVEMENT"); const [url, setUrl] = useState(""); const [message, setMessage] = useState(""); async function submit(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/profile/achievements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, type, url }) }); const data = await response.json(); if (!response.ok) { setMessage(data.message ?? "Could not save portfolio item."); return; } setTitle(""); setUrl(""); setMessage("Portfolio item saved."); onSaved(); } return <form onSubmit={submit} className="mt-4 space-y-2 border-t pt-4"><div className="flex gap-2"><input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="min-w-0 flex-1 rounded-lg border p-2 text-sm" /><select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border p-2 text-xs"><option>ACHIEVEMENT</option><option>PROJECT</option><option>LINK</option></select></div><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Optional https:// link" className="w-full rounded-lg border p-2 text-sm" /><button className="text-sm font-semibold text-blue-700">Add portfolio item</button>{message && <p role="status" className="text-xs text-slate-500">{message}</p>}</form>; }

function CorrectionForm({ onSaved }: { onSaved: () => void }) { const [field, setField] = useState("currentSemester"); const [proposedValue, setProposedValue] = useState(""); const [message, setMessage] = useState(""); async function submit(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/profile/corrections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field, proposedValue }) }); const data = await response.json(); if (!response.ok) { setMessage(data.message ?? "Correction could not be submitted."); return; } setProposedValue(""); setMessage("Correction request sent to the Administrator."); onSaved(); } return <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2 border-t pt-4"><select value={field} onChange={(e) => setField(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="currentSemester">Current semester</option><option value="admissionYear">Admission year</option><option value="batch">Batch</option><option value="departmentId">Department</option><option value="programId">Program</option><option value="institutionalId">Institutional ID</option></select><input required maxLength={1000} value={proposedValue} onChange={(e) => setProposedValue(e.target.value)} placeholder="Requested value" className="min-w-40 flex-1 rounded-lg border p-2 text-sm" /><button className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Request correction</button>{message && <p role="status" className="w-full text-xs text-slate-500">{message}</p>}</form>; }
