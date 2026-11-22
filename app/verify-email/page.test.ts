import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("OTP verification UI", () => {
  it("defines explicit light and dark theme tokens", () => {
    const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain("--background: #ffffff");
    expect(css).toContain("--background: #09090b");
  });
  it("provides a refreshable App Router verification route", () => {
    const page = path.join(process.cwd(), "app", "verify-email", "page.tsx");
    expect(existsSync(page)).toBe(true);
    const source = readFileSync(page, "utf8");
    expect(source).toContain("/api/auth/verify-otp");
    expect(source).toContain("/api/auth/resend-otp");
    expect(source).toContain('URLSearchParams(window.location.search)');
    expect(source).toContain("pattern=\"[0-9]{6}\"");
  });

  it("uses the verified endpoints with their actual email and code fields", () => {
    const source = readFileSync(path.join(process.cwd(), "app", "verify-email", "page.tsx"), "utf8");
    expect(source).toContain("JSON.stringify({ email, code })");
    expect(source).toContain("JSON.stringify({ email })");
  });
});
