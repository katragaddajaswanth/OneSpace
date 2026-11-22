import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUniversityUser: vi.fn(),
  queryRaw: vi.fn(),
  connection: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUniversityUser: mocks.requireUniversityUser,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));
vi.mock("next/server", () => ({ connection: mocks.connection }));

import { GET } from "./route";

describe("GET /api/db-health", () => {
  beforeEach(() => {
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUniversityUser.mockResolvedValue({
      user: { id: "user_123", universityId: "university_123" },
    });
    mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  });

  it("rejects unauthenticated requests without running the health query", async () => {
    const authResponse = Response.json(
      { success: false, message: "Authentication required." },
      { status: 401 }
    );
    mocks.requireUniversityUser.mockResolvedValue({ response: authResponse });
    const request = new Request("http://localhost/api/db-health");

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mocks.requireUniversityUser).toHaveBeenCalledWith(request);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("waits for an incoming request and returns only the minimal success response", async () => {
    const response = await GET(new Request("http://localhost/api/db-health"));

    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.connection.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requireUniversityUser.mock.invocationCallOrder[0]
    );
    expect(mocks.requireUniversityUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.queryRaw.mock.invocationCallOrder[0]
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("allows Next.js prerender interruption to escape without querying the database", async () => {
    const prerenderInterruption = new Error("framework prerender interruption");
    mocks.connection.mockRejectedValue(prerenderInterruption);

    await expect(GET(new Request("http://localhost/api/db-health"))).rejects.toBe(
      prerenderInterruption
    );
    expect(mocks.requireUniversityUser).not.toHaveBeenCalled();
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("returns a minimal unavailable response and logs no database details on failure", async () => {
    const databaseError = new Error("private Neon host, credentials, and SQL details");
    mocks.queryRaw.mockRejectedValue(databaseError);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(new Request("http://localhost/api/db-health"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(log).toHaveBeenCalledWith("DATABASE_HEALTH_CHECK_FAILED");
    expect(log.mock.calls.flat().join(" ")).not.toContain(databaseError.message);
    log.mockRestore();
  });
});
