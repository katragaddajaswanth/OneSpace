"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [universitySlug, setUniversitySlug] = useState("demo-university");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; programs: Array<{ id: string; name: string }> }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void fetch("/api/university-registration-options", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: "PROSPECTIVE_STUDENT",
          fullName,
          email,
          password,
          universitySlug,
          departmentId: departmentId || undefined,
          programId: programId || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Registration could not be completed.");
      setSuccess("Registration successful. Redirecting to email verification.");
      router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const programs = departments.find((department) => department.id === departmentId)?.programs ?? [];
  return (
    <main className="page-enter min-h-screen px-4 py-10" style={{ background: "var(--surface-secondary)", color: "var(--foreground)" }}>
      <div className="surface-card mx-auto max-w-xl p-6 sm:p-8">
        <Link href="/login" className="text-sm font-semibold text-blue-700">← Sign in</Link>
        <h1 className="mt-5 text-3xl font-bold">Prospective student registration</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Create a public university exploration account. Enrollment is not granted automatically.</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Full name<input required minLength={2} maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
          <label className="block text-sm font-medium">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
          <label className="block text-sm font-medium">Password<input type="password" required minLength={12} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
          <label className="block text-sm font-medium">University<input value={universitySlug} onChange={(event) => setUniversitySlug(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
          <label className="block text-sm font-medium">Intended department<select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setProgramId(""); }} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="">Not selected</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <label className="block text-sm font-medium">Intended program<select value={programId} onChange={(event) => setProgramId(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="">Not selected</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
          <button disabled={busy} className="w-full rounded-xl bg-blue-800 px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Creating account…" : "Register as prospective student"}</button>
        </form>
      </div>
    </main>
  );
}
