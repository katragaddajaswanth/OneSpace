import { describe, expect, it } from "vitest";
import { isReadOnlyDemoUser } from "./demo-protection";

describe("read-only demo protection", () => {
  it("recognizes only a fully marked demo university account", () => {
    expect(isReadOnlyDemoUser({
      isDemoAccount: true,
      university: { kind: "DEMO", isReadOnlyDemo: true },
    })).toBe(true);
  });

  it("does not grant demo write protection based on client role or partial markers", () => {
    expect(isReadOnlyDemoUser({
      isDemoAccount: true,
      university: { kind: "REAL", isReadOnlyDemo: true },
    })).toBe(false);
    expect(isReadOnlyDemoUser({
      isDemoAccount: true,
      university: { kind: "DEMO", isReadOnlyDemo: false },
    })).toBe(false);
    expect(isReadOnlyDemoUser({
      isDemoAccount: false,
      university: { kind: "DEMO", isReadOnlyDemo: true },
    })).toBe(false);
    expect(isReadOnlyDemoUser({ isDemoAccount: true, university: null })).toBe(false);
  });

  it("keeps real university accounts writable", () => {
    expect(isReadOnlyDemoUser({
      isDemoAccount: false,
      university: { kind: "REAL", isReadOnlyDemo: false },
    })).toBe(false);
  });
});
