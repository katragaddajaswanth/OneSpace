import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUniversityUser: vi.fn(),
  opportunityUniversityScope: vi.fn(),
  applicationFindMany: vi.fn(),
  applicationCount: vi.fn(),
  connection: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUniversityUser: mocks.requireUniversityUser,
  opportunityUniversityScope: mocks.opportunityUniversityScope,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    opportunityApplication: {
      findMany: mocks.applicationFindMany,
      count: mocks.applicationCount,
    },
  },
}));
vi.mock("next/server", () => ({ connection: mocks.connection }));

import { GET } from "./route";

const endpoint = "http://localhost/api/opportunities/applications";
const user = {
  id: "student_db_123",
  universityId: "university_db_123",
  primaryRole: "STUDENT",
  secondaryRoles: [],
};

function authFailure(status: number) {
  return { response: Response.json({ success: false }, { status }) };
}

describe("GET /api/opportunities/applications", () => {
  beforeEach(() => {
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUniversityUser.mockResolvedValue({ user });
    mocks.opportunityUniversityScope.mockImplementation((authorizedUser) => ({
      universityId: authorizedUser.universityId,
      submitter: { is: { universityId: authorizedUser.universityId } },
    }));
    mocks.applicationFindMany.mockResolvedValue([]);
    mocks.applicationCount.mockResolvedValue(0);
  });

  it("returns only this student’s applications with their university-scoped opportunity details", async () => {
    const request = new Request(`${endpoint}?page=2&limit=5`);
    const response = await GET(request);
    const result = await response.json();
    const where = mocks.applicationFindMany.mock.calls[0][0].where;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.requireUniversityUser).toHaveBeenCalledWith(request);
    expect(where).toEqual({
      studentId: "student_db_123",
      student: {
        is: {
          id: "student_db_123",
          universityId: "university_db_123",
          primaryRole: "STUDENT",
        },
      },
      opportunity: {
        is: {
          universityId: "university_db_123",
          submitter: { is: { universityId: "university_db_123" } },
        },
      },
    });
    expect(mocks.applicationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 5,
      take: 5,
      select: {
        id: true,
        status: true,
        appliedAt: true,
        opportunity: {
          select: {
            id: true,
            title: true,
            organization: true,
            type: true,
            location: true,
            workMode: true,
            applicationDeadline: true,
          },
        },
      },
    }));
    expect(mocks.applicationCount).toHaveBeenCalledWith({ where });
    expect(result.pagination).toEqual({ page: 2, limit: 5, total: 0, totalPages: 0 });
  });

  it("rejects unauthenticated and non-student requests", async () => {
    mocks.requireUniversityUser.mockResolvedValue(authFailure(401));
    expect((await GET(new Request(endpoint))).status).toBe(401);
    mocks.requireUniversityUser.mockResolvedValue(authFailure(403));
    expect((await GET(new Request(endpoint))).status).toBe(403);

    mocks.requireUniversityUser.mockResolvedValue({ user: { ...user, primaryRole: "ALUMNI" } });
    expect((await GET(new Request(endpoint))).status).toBe(403);
    expect(mocks.applicationFindMany).not.toHaveBeenCalled();
  });

  it("validates pagination and rejects unsupported or repeated parameters", async () => {
    for (const query of ["?page=0", "?limit=51", "?limit=nope", "?userId=someone", "?page=1&page=2"]) {
      const response = await GET(new Request(`${endpoint}${query}`));
      expect(response.status).toBe(400);
    }
    expect(mocks.applicationFindMany).not.toHaveBeenCalled();
  });

  it("returns an empty paginated history for a student with no applications", async () => {
    const response = await GET(new Request(endpoint));
    const result = await response.json();
    expect(result).toEqual({
      success: true,
      applications: [],
      pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
    });
  });

  it("returns a generic response when the database query fails", async () => {
    mocks.applicationFindMany.mockRejectedValue(new Error("private SQL and database details"));
    const response = await GET(new Request(endpoint));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private SQL and database details");
  });
});
