import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUniversityUser: vi.fn(),
  opportunityUniversityScope: vi.fn(),
  opportunityFindFirst: vi.fn(),
  savedCreate: vi.fn(),
  savedDeleteMany: vi.fn(),
  connection: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUniversityUser: mocks.requireUniversityUser,
  opportunityUniversityScope: mocks.opportunityUniversityScope,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    opportunity: { findFirst: mocks.opportunityFindFirst },
    savedOpportunity: {
      create: mocks.savedCreate,
      deleteMany: mocks.savedDeleteMany,
    },
  },
}));
vi.mock("next/server", () => ({ connection: mocks.connection }));

import { DELETE, POST } from "./route";

const endpoint = "http://localhost/api/opportunities/opp_123/save";
const user = {
  id: "student_db_123",
  universityId: "university_db_123",
  primaryRole: "STUDENT",
  secondaryRoles: [],
};
const context = { params: Promise.resolve({ id: "opp_123" }) };

function request(method: "POST" | "DELETE", body?: unknown) {
  return new Request(endpoint, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}

function authFailure(status: number) {
  return { response: Response.json({ success: false }, { status }) };
}

describe("/api/opportunities/[id]/save", () => {
  beforeEach(() => {
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUniversityUser.mockResolvedValue({ user });
    mocks.opportunityUniversityScope.mockImplementation((authorizedUser) => ({
      universityId: authorizedUser.universityId,
      submitter: { is: { universityId: authorizedUser.universityId } },
    }));
    mocks.opportunityFindFirst.mockResolvedValue({ id: "opp_123" });
    mocks.savedCreate.mockResolvedValue({
      id: "saved_123",
      opportunityId: "opp_123",
      savedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mocks.savedDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("allows a student primary role and saves using authenticated identity", async () => {
    const req = request("POST");
    const response = await POST(req, context);

    expect(response.status).toBe(201);
    expect(mocks.requireUniversityUser).toHaveBeenCalledWith(req);
    expect(mocks.opportunityUniversityScope).toHaveBeenCalledWith(user);
    expect(mocks.opportunityFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "opp_123",
        universityId: "university_db_123",
        submitter: { is: { universityId: "university_db_123" } },
        status: "APPROVED",
        publishedAt: { not: null },
        applicationDeadline: { gt: expect.any(Date) },
        closedAt: null,
      }),
      select: { id: true },
    });
    expect(mocks.savedCreate).toHaveBeenCalledWith({
      data: { opportunityId: "opp_123", studentId: "student_db_123" },
      select: { id: true, opportunityId: true, savedAt: true },
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each(["ALUMNI", "FACULTY", "PROSPECTIVE_STUDENT"])(
    "rejects primary role %s",
    async (primaryRole) => {
      mocks.requireUniversityUser.mockResolvedValue({ user: { ...user, primaryRole } });
      const response = await POST(request("POST"), context);
      expect(response.status).toBe(403);
      expect(mocks.opportunityFindFirst).not.toHaveBeenCalled();
    }
  );

  it("returns auth and membership failures without database writes", async () => {
    mocks.requireUniversityUser.mockResolvedValue(authFailure(401));
    expect((await POST(request("POST"), context)).status).toBe(401);
    mocks.requireUniversityUser.mockResolvedValue(authFailure(403));
    expect((await POST(request("POST"), context)).status).toBe(403);
    expect(mocks.savedCreate).not.toHaveBeenCalled();
  });

  it("returns 404 for cross-university opportunities", async () => {
    mocks.opportunityFindFirst.mockResolvedValue(null);
    const response = await POST(request("POST"), context);
    expect(response.status).toBe(404);
    expect(mocks.savedCreate).not.toHaveBeenCalled();
  });

  it.each(["pending", "rejected", "unpublished", "expired", "closed"])(
    "excludes %s opportunities",
    async () => {
      mocks.opportunityFindFirst.mockResolvedValue(null);
      const response = await POST(request("POST"), context);
      expect(response.status).toBe(404);
      expect(mocks.opportunityFindFirst.mock.calls[0][0].where).toMatchObject({
        status: "APPROVED",
        publishedAt: { not: null },
        applicationDeadline: { gt: expect.any(Date) },
        closedAt: null,
      });
    }
  );

  it("returns 409 for a duplicate save", async () => {
    mocks.savedCreate.mockRejectedValue(Object.assign(new Error("duplicate"), { code: "P2002" }));
    expect((await POST(request("POST"), context)).status).toBe(409);
  });

  it("rejects forged identity and university fields", async () => {
    const response = await POST(
      request("POST", { studentId: "other", userId: "other", universityId: "other" }),
      context
    );
    expect(response.status).toBe(400);
    expect(mocks.savedCreate).not.toHaveBeenCalled();
  });

  it("returns a generic error when save persistence fails", async () => {
    mocks.savedCreate.mockRejectedValue(new Error("private database details"));
    const response = await POST(request("POST"), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database details");
  });

  it("removes only the authenticated student's university-scoped saved row", async () => {
    const response = await DELETE(request("DELETE"), context);
    expect(response.status).toBe(200);
    expect(mocks.savedDeleteMany).toHaveBeenCalledWith({
      where: {
        opportunityId: "opp_123",
        studentId: "student_db_123",
        opportunity: {
          is: {
            universityId: "university_db_123",
            submitter: { is: { universityId: "university_db_123" } },
          },
        },
      },
    });
  });

  it("returns 404 when no own saved row exists, including another student's row", async () => {
    mocks.savedDeleteMany.mockResolvedValue({ count: 0 });
    const response = await DELETE(request("DELETE"), context);
    expect(response.status).toBe(404);
    expect(mocks.savedDeleteMany.mock.calls[0][0].where.studentId).toBe("student_db_123");
  });

  it("returns 404 for cross-university unsave attempts", async () => {
    mocks.savedDeleteMany.mockResolvedValue({ count: 0 });
    const response = await DELETE(request("DELETE"), context);
    expect(response.status).toBe(404);
    expect(mocks.savedDeleteMany.mock.calls[0][0].where.opportunity.is.universityId)
      .toBe("university_db_123");
  });

  it("returns a generic error when unsave persistence fails", async () => {
    mocks.savedDeleteMany.mockRejectedValue(new Error("private database details"));
    const response = await DELETE(request("DELETE"), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database details");
  });
});
