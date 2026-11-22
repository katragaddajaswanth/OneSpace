import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUniversityUser: vi.fn(),
  opportunityUniversityScope: vi.fn(),
  savedFindMany: vi.fn(),
  savedCount: vi.fn(),
  connection: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUniversityUser: mocks.requireUniversityUser,
  opportunityUniversityScope: mocks.opportunityUniversityScope,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { savedOpportunity: { findMany: mocks.savedFindMany, count: mocks.savedCount } },
}));
vi.mock("next/server", () => ({ connection: mocks.connection }));

import { GET } from "./route";

const endpoint = "http://localhost/api/opportunities/saved";
const user = {
  id: "student_db_123",
  universityId: "university_db_123",
  primaryRole: "STUDENT",
  secondaryRoles: [],
};

function authFailure(status: number) {
  return { response: Response.json({ success: false }, { status }) };
}

describe("GET /api/opportunities/saved", () => {
  beforeEach(() => {
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUniversityUser.mockResolvedValue({ user });
    mocks.opportunityUniversityScope.mockImplementation((authorizedUser) => ({
      universityId: authorizedUser.universityId,
      submitter: { is: { universityId: authorizedUser.universityId } },
    }));
    mocks.savedFindMany.mockResolvedValue([]);
    mocks.savedCount.mockResolvedValue(0);
  });

  it("returns only authenticated student's discoverable records with pagination and private caching", async () => {
    const response = await GET(new Request(`${endpoint}?page=2&limit=5`));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.savedFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        studentId: "student_db_123",
        opportunity: {
          is: expect.objectContaining({
            universityId: "university_db_123",
            submitter: { is: { universityId: "university_db_123" } },
            status: "APPROVED",
            publishedAt: { not: null },
            applicationDeadline: { gt: expect.any(Date) },
            closedAt: null,
          }),
        },
      }),
      orderBy: { savedAt: "desc" },
      skip: 5,
      take: 5,
      select: expect.objectContaining({
        savedAt: true,
        opportunity: {
          select: expect.objectContaining({ id: true, title: true }),
        },
      }),
    });
    expect(mocks.savedCount).toHaveBeenCalledWith({
      where: mocks.savedFindMany.mock.calls[0][0].where,
    });
    expect(result.pagination).toEqual({ page: 2, limit: 5, total: 0, totalPages: 0 });
    expect(result.savedOpportunities).toEqual([]);
  });

  it("rejects non-student and unauthenticated users", async () => {
    mocks.requireUniversityUser.mockResolvedValue({ user: { ...user, primaryRole: "ALUMNI" } });
    expect((await GET(new Request(endpoint))).status).toBe(403);
    mocks.requireUniversityUser.mockResolvedValue(authFailure(401));
    expect((await GET(new Request(endpoint))).status).toBe(401);
    expect(mocks.savedFindMany).not.toHaveBeenCalled();
  });

  it("returns the empty list with default pagination", async () => {
    const response = await GET(new Request(endpoint));
    const result = await response.json();
    expect(result.pagination).toEqual({ page: 1, limit: 12, total: 0, totalPages: 0 });
    expect(mocks.savedFindMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 12 });
  });

  it.each(["pending", "rejected", "unpublished", "expired", "closed"])(
    "filters %s opportunities from the database query",
    async () => {
      await GET(new Request(endpoint));
      const relationWhere = mocks.savedFindMany.mock.calls[0][0].where.opportunity.is;
      expect(relationWhere).toMatchObject({
        status: "APPROVED",
        publishedAt: { not: null },
        applicationDeadline: { gt: expect.any(Date) },
        closedAt: null,
      });
    }
  );

  it.each(["?page=0", "?limit=51", "?limit=abc", "?userId=someone", "?page=1&page=2"])(
    "rejects invalid pagination query %s",
    async (query) => {
      const response = await GET(new Request(`${endpoint}${query}`));
      expect(response.status).toBe(400);
      expect(mocks.savedFindMany).not.toHaveBeenCalled();
    }
  );

  it("returns a generic response when the database query fails", async () => {
    mocks.savedFindMany.mockRejectedValue(new Error("private database details"));
    const response = await GET(new Request(endpoint));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database details");
  });
});
