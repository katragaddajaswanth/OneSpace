
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import type { CSSProperties } from "react";
import ThemeToggle from "../../components/ThemeToggle";

const styles = new Proxy<Record<string, string>>({}, {
  get: (_, property) => String(property),
});

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const verifiedEmail = params.get("email");
      if (verifiedEmail) setEmail(verifiedEmail);
      if (params.get("verified") === "1") setNotice("Email verified. Sign in to continue.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Login failed. Please try again.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.loginPage}>
      <ThemeToggle className={styles.themeToggle} />
      <div className={styles.loginCard}>
        <section className={styles.brandPanel}>
          <div className={styles.brandLockup}>
            <p className={styles.logo}>One-Space</p>
            <p className={styles.tagline}>Your university. Connected.</p>
          </div>

          <div className={styles.brandCopy}>
            <p className={styles.eyebrow}>ONE UNIVERSITY ECOSYSTEM</p>
            <h1>
              One space.
              <br />
              <span className={styles.gradientText}>Endless possibilities.</span>
            </h1>
            <p className={styles.description}>
              Connect with your university community, discover opportunities, manage your academic journey and build your future.
            </p>
          </div>

          <p className={styles.brandFooter}>One-Space © 2026</p>
          <svg className={styles.orbit} viewBox="0 0 480 480" aria-hidden="true">
            <g className={`${styles.orbitRing} ${styles.orbitRingOne}`}><circle cx="240" cy="240" r="70" /></g>
            <g className={`${styles.orbitRing} ${styles.orbitRingTwo}`}><circle cx="240" cy="240" r="120" /></g>
            <g className={`${styles.orbitRing} ${styles.orbitRingThree}`}><circle cx="240" cy="240" r="170" /></g>
            <g className={`${styles.orbitRing} ${styles.orbitRingFour}`}><circle cx="240" cy="240" r="220" /></g>
            <circle className={styles.orbitCentre} cx="240" cy="240" r="4" />
            <g className={`${styles.orbitDot} ${styles.orbitDotOne}`}><circle cx="240" cy="170" r="5" /></g>
            <g className={`${styles.orbitDot} ${styles.orbitDotTwo}`}><circle cx="240" cy="120" r="5" /></g>
            <g className={`${styles.orbitDot} ${styles.orbitDotThree}`}><circle cx="240" cy="70" r="5" /></g>
            <g className={`${styles.orbitDot} ${styles.orbitDotFour}`}><circle cx="240" cy="20" r="5" /></g>
            <g className={`${styles.orbitDot} ${styles.orbitDotFive}`}><circle cx="240" cy="0" r="5" /></g>
          </svg>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.formContent}>
            <div className={`${styles.mobileBrand} ${styles.staggerItem}`} style={{ "--delay": "0ms" } as CSSProperties}>
              <p className={styles.logo}>One-Space</p>
              <p className={styles.tagline}>Your university. Connected.</p>
            </div>

            <p className={`${styles.formEyebrow} ${styles.staggerItem}`} style={{ "--delay": "60ms" } as CSSProperties}>WELCOME BACK</p>
            <h2 className={styles.formTitle} style={{ "--delay": "120ms" } as CSSProperties}>Sign in to One-Space</h2>
            <p className={`${styles.formSubtext} ${styles.staggerItem}`} style={{ "--delay": "180ms" } as CSSProperties}>Continue your academic and professional journey.</p>

            <form onSubmit={handleLogin} className={styles.form}>
              <div className={`${styles.fieldGroup} ${styles.staggerItem}`} style={{ "--delay": "240ms" } as CSSProperties}>
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  autoComplete="email"
                  autoFocus
                  required
                  aria-describedby={error ? "login-error" : undefined}
                  className={error ? styles.hasError : undefined}
                />
              </div>

              <div className={`${styles.fieldGroup} ${styles.staggerItem}`} style={{ "--delay": "300ms" } as CSSProperties}>
                <label htmlFor="password">Password</label>
                <div className={styles.passwordField}>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    aria-describedby={error ? "login-error" : undefined}
                    className={error ? styles.hasError : undefined}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && <p id="login-error" className={styles.error} role="alert" aria-live="polite">{error}</p>}
              {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}

              <button type="submit" disabled={loading} className={`${styles.submitButton} ${styles.staggerItem}`} style={{ "--delay": "360ms" } as CSSProperties}>
                {loading ? <><span className={styles.spinner} aria-hidden="true" />Signing in...</> : <>Sign in <span className={styles.buttonArrow} aria-hidden="true">→</span></>}
              </button>
            </form>

            <p className={`${styles.securityNote} ${styles.staggerItem}`} style={{ "--delay": "420ms" } as CSSProperties}>
              <svg className={styles.lockIcon} viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="2" />
                <path d="M5 7V5a3 3 0 0 1 6 0v2" />
              </svg>
              Secure access to your university ecosystem.
            </p>

            <div className={`${styles.registerBlock} ${styles.staggerItem}`} style={{ "--delay": "480ms" } as CSSProperties}>
              <span className={styles.divider} />
              <p>Interested in joining a university?{" "}
                <Link href="/register">Register as a prospective student <span aria-hidden="true">→</span></Link>
              </p>
            </div>

            <p className={styles.formFooter}>© 2026 One-Space. All rights reserved.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
