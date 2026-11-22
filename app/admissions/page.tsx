"use client";

import Link from "next/link";

export default function AdmissionsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/" className="text-sm font-semibold text-blue-700">← Dashboard</Link>
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">One-Space / Admissions</p>
          <h1 className="mt-2 text-3xl font-bold">Admissions information</h1>
        </header>
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-bold">Prospective student status</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Your account is not an enrolled-student record. Explore public university information, departments,
            programs and campus activities while an administrator or authorized university process determines
            eligibility and enrollment.
          </p>
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Admission applications do not automatically grant student privileges. An institutional record must be
            verified and your account converted by an authorized university administrator.
          </p>
        </section>
      </div>
    </main>
  );
}
