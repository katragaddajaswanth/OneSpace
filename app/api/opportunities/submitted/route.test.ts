import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUniversityUser: vi.fn(),
  opportunityFindMany: vi.fn(),
  opportunityCount: vi.fn(),
  connection: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireUniversityUser: mocks.requireUniversityUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: { opportunity: { findMany: mocks.opportunityFindMany, count: mocks.opportunityCount } },
}));
vi.mock("next/server", () => ({ connection: mocks.connection }));

import { GET } from "./route";

const endpoint = "http://localhost/api/opportunities/submitted";
const alumni = {
  id: "alumni_db_1",
  universityId: "university_1",
  primaryRole: "ALUMNI",
  secondaryRoles: [],
};
const industryRepresentative = {
  id: "industry_db_1",
  universityId: "university_1",
  primaryRole: "FACULTY",
  secondaryRoles: [{ role: "INDUSTRY_REPRESENTATIVE" }],
};

function authFailure(status: number) {
  return { response: Response.json({ success: false }, { status }) };
}

describe("GET /api/opportunities/submitted", () => {
  beforeEach(() => {
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUniversityUser.mockResolvedValue({ user: alumni });
    mocks.opportunityFindMany.mockResolvedValue([]);
    mocks.opportunityCount.mockResolvedValue(0);
  });

  it.each([
    ["Alumni primary role", alumni],
    ["Industry Representative secondary role", industryRepresentative],
  ])("authorizes %s and restricts results to the authenticated submitter", async (_label, user) => {
    mocks.requireUniversityUser.mockResolvedValue({ user });
    const response = await GET(new Request(`${endpoint}?page=2&limit=5`));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.opportunityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        submittedById: user.id,
        universityId: user.universityId,
        submitter: { is: { id: user.id, universityId: user.universityId } },
      },
      skip: 5,
      take: 5,
      select: expect.objectContaining({
        status: true,
        createdAt: true,
        publishedAt: true,
        approvalHistory: {
          orderBy: { reviewedAt: "desc" },
          take: 1,
          select: { decision: true, reason: true, reviewedAt: true },
        },
      }),
    }));
    expect(mocks.opportunityCount).toHaveBeenCalledWith({
      where: mocks.opportunityFindMany.mock.calls[0][0].where,
    });
    expect(result.pagination).toEqual({ page: 2, limit: 5, total: 0, totalPages: 0 });
  });

  it.each([
    ["student", { ...alumni, primaryRole: "STUDENT" }],
    ["faculty without IR secondary role", { ...industryRepresentative, secondaryRoles: [] }],
    ["unrelated secondary role", { ...alumni, primaryRole: "FACULTY", secondaryRoles: [{ role: "MENTOR" }] }],
  ])("rejects %s", async (_label, user) => {
    mocks.requireUniversityUser.mockResolvedValue({ user });
    const response = await GET(new Request(endpoint));
    expect(response.status).toBe(403);
    expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
  });

  it("preserves authentication and missing-membership failures", async () => {
    mocks.requireUniversityUser.mockResolvedValue(authFailure(401));
    expect((await GET(new Request(endpoint))).status).toBe(401);
    mocks.requireUniversityUser.mockResolvedValue(authFailure(403));
    expect((await GET(new Request(endpoint))).status).toBe(403);
    expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
  });

  it("validates pagination parameters", async () => {
    for (const query of ["?page=0", "?limit=51", "?limit=nope", "?page=1&page=2", "?userId=other"]) {
      expect((await GET(new Request(`${endpoint}${query}`))).status).toBe(400);
    }
    expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
  });

  it("returns generic errors if the database query fails", async () => {
    mocks.opportunityFindMany.mockRejectedValue(new Error("private SQL details"));
    const response = await GET(new Request(endpoint));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private SQL details");
  });
});
