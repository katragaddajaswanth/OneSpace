import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), connection: vi.fn(), userFindMany: vi.fn(), projectFindMany: vi.fn(), communityFindMany: vi.fn(), mentorFindMany: vi.fn(), opportunityFindMany: vi.fn(), skillFindMany: vi.fn(), certificationFindMany: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUniversityUser: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: mocks.userFindMany }, project: { findMany: mocks.projectFindMany }, community: { findMany: mocks.communityFindMany }, mentorProfile: { findMany: mocks.mentorFindMany }, opportunity: { findMany: mocks.opportunityFindMany }, profileSkillVerification: { findMany: mocks.skillFindMany }, profileCertification: { findMany: mocks.certificationFindMany } } }));
vi.mock("next/server", () => ({ connection: mocks.connection }));
import { GET } from "./route";

describe("GET /api/search", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.connection.mockResolvedValue(undefined); mocks.auth.mockResolvedValue({ user: { id: "user-1", universityId: "uni-1" } }); for (const fn of [mocks.userFindMany, mocks.projectFindMany, mocks.communityFindMany, mocks.mentorFindMany, mocks.opportunityFindMany, mocks.skillFindMany, mocks.certificationFindMany]) fn.mockResolvedValue([]); });
  it("rejects unsupported filters and short queries", async () => {
    expect((await GET(new Request("http://localhost/api/search?q=x"))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/search?q=student&universityId=uni-other"))).status).toBe(400);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });
  it("scopes user and project discovery to the authenticated university", async () => {
    const response = await GET(new Request("http://localhost/api/search?q=systems"));
    expect(response.status).toBe(200);
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ universityId: "uni-1" }) }));
    expect(mocks.projectFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ universityId: "uni-1" }) }));
    expect(await response.json()).toMatchObject({ success: true, results: [], pagination: { page: 1, limit: 12, total: 0 } });
  });
  it("returns the authentication failure without querying any module", async () => {
    mocks.auth.mockResolvedValue({ response: Response.json({ success: false }, { status: 401 }) });
    expect((await GET(new Request("http://localhost/api/search?q=systems"))).status).toBe(401);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });
});
