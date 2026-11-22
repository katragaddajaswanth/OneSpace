"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { WorkflowSteps } from "@/components/ui/WorkflowSteps";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail((params.get("email") ?? "").trim().toLowerCase());
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!email) {
      setError("Missing verification email. Register again or open the verification link from your registration.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the complete 6-digit OTP.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "OTP verification failed.");
      setSuccess("Email verified successfully. Redirecting to sign in.");
      window.setTimeout(() => router.replace(`/login?email=${encodeURIComponent(email)}&verified=1`), 700);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "OTP verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    setSuccess("");
    if (!email) {
      setError("Missing verification email.");
      return;
    }
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not resend OTP.");
      setSuccess("A new OTP has been sent. Check your email.");
      setResendSeconds(60);
      setCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resend OTP.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="page-enter flex min-h-screen w-full items-center justify-center overflow-x-hidden px-3 py-6 sm:px-4 sm:py-10" style={{ background: "var(--surface-secondary)", color: "var(--foreground)" }}>
      <div className="surface-card w-full max-w-md min-w-0 p-5 sm:p-9" style={{ boxShadow: "var(--shadow-lg)" }}>
        <Link href="/login" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>← Back to sign in</Link>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>One-Space verification</p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>Verify your email</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
          Enter the 6-digit code sent to
          {email ? <span className="mt-1 block break-all font-semibold" style={{ color: "var(--foreground)" }}>{email}</span> : <span className="mt-1 block font-semibold" style={{ color: "var(--danger)" }}>your registered email</span>}
        </p>

        {error && <p role="alert" className="mt-5 rounded-xl p-4 text-sm" style={{ background: "var(--danger-subtle)", color: "var(--danger)" }}>{error}</p>}
        {success && <p role="status" className="mt-5 rounded-xl p-4 text-sm" style={{ background: "var(--success-subtle)", color: "var(--success)" }}>{success}</p>}

        <div className="mt-6">
          <WorkflowSteps
            steps={[
              { id: "details", title: "Account details", description: "Registration information received.", state: "completed" },
              { id: "email", title: "Email verification", description: "Enter the 6-digit code sent to your inbox.", state: success ? "completed" : "active", detail: null },
              { id: "access", title: "Sign in", description: "Access becomes available after verification.", state: success ? "active" : "pending" },
            ]}
          />
        </div>

        <form onSubmit={verify} className="mt-6 space-y-5">
          <label className="block text-sm font-medium" style={{ color: "var(--foreground)" }}>
            6-digit verification code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              aria-label="6-digit verification code"
              className="form-input mt-2 px-4 py-4 text-center text-2xl font-bold tracking-[0.45em]"
              placeholder="000000"
            />
          </label>
          <button disabled={busy || code.length !== 6 || !email} className="ui-button ui-button-primary w-full">
            {busy ? "Verifying…" : "Verify OTP"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void resend()}
          disabled={resending || resendSeconds > 0 || !email}
          className="ui-button ui-button-secondary mt-4 w-full"
        >
          {resending ? "Sending…" : resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : "Resend OTP"}
        </button>
        <p className="mt-5 text-center text-xs leading-5" style={{ color: "var(--text-tertiary)" }}>The OTP expires in 5 minutes. Never share it with anyone.</p>
      </div>
    </main>
  );
}
