import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUniversityUser: vi.fn(),
  opportunityUniversityScope: vi.fn(),
  opportunityFindFirst: vi.fn(),
  applicationCreate: vi.fn(),
  connection: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUniversityUser: mocks.requireUniversityUser,
  opportunityUniversityScope: mocks.opportunityUniversityScope,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    opportunity: { findFirst: mocks.opportunityFindFirst },
    opportunityApplication: { create: mocks.applicationCreate },
  },
}));

vi.mock("next/server", () => ({ connection: mocks.connection }));

import { POST } from "./route";

const endpoint = "http://localhost/api/opportunities/opp_123/apply";

function makeUser(primaryRole = "STUDENT", secondaryRoles: string[] = []) {
  return {
    id: "student_db_123",
    universityId: "university_db_123",
    primaryRole,
    secondaryRoles: secondaryRoles.map((role) => ({ role })),
  };
}

function request(body: unknown = {}) {
  return new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authFailure(status: number, message: string) {
  return {
    response: Response.json({ success: false, message }, { status }),
  };
}

describe("POST /api/opportunities/[id]/apply", () => {
  beforeEach(() => {
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUniversityUser.mockResolvedValue({ user: makeUser() });
    mocks.opportunityUniversityScope.mockImplementation((user) => ({
      universityId: user.universityId,
      submitter: { is: { universityId: user.universityId } },
    }));
    mocks.opportunityFindFirst.mockResolvedValue({ id: "opp_123" });
    mocks.applicationCreate.mockImplementation(async ({ data }) => ({
      id: "application_123",
      status: data.status,
      appliedAt: new Date("2026-01-01T00:00:00.000Z"),
    }));
  });

  it("authorizes a student through the primary role and shared university guard", async () => {
    const req = request();
    const response = await POST(req, { params: Promise.resolve({ id: "opp_123" }) });

    expect(response.status).toBe(201);
    expect(mocks.requireUniversityUser).toHaveBeenCalledWith(req);
    expect(mocks.opportunityUniversityScope).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "student_db_123",
        universityId: "university_db_123",
        primaryRole: "STUDENT",
      })
    );
  });

  it.each([
    ["Alumni", makeUser("ALUMNI")],
    ["Industry Representatives", makeUser("ALUMNI", ["INDUSTRY_REPRESENTATIVE"])],
    ["Faculty", makeUser("FACULTY")],
    ["Prospective students", makeUser("PROSPECTIVE_STUDENT")],
  ])("rejects %s", async (_label, user) => {
    mocks.requireUniversityUser.mockResolvedValue({ user });

    const response = await POST(request(), {
      params: Promise.resolve({ id: "opp_123" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.opportunityFindFirst).not.toHaveBeenCalled();
  });

  it("returns 401 when no authenticated university member is present", async () => {
    mocks.requireUniversityUser.mockResolvedValue(
      authFailure(401, "Authentication required.")
    );

    const response = await POST(request(), {
      params: Promise.resolve({ id: "opp_123" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.opportunityFindFirst).not.toHaveBeenCalled();
  });

  it("scopes eligibility to the student's university and the submitter's university", async () => {
    await POST(request(), { params: Promise.resolve({ id: "opp_123" }) });

    expect(mocks.opportunityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "opp_123",
          universityId: "university_db_123",
          submitter: { is: { universityId: "university_db_123" } },
        }),
      })
    );
  });

  it("returns 404 for cross-university opportunities", async () => {
    mocks.opportunityFindFirst.mockResolvedValue(null);

    const response = await POST(request(), {
      params: Promise.resolve({ id: "opp_123" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.applicationCreate).not.toHaveBeenCalled();
  });

  it.each(["pending", "rejected", "unpublished", "expired", "closed"])(
    "excludes %s opportunities",
    async () => {
    mocks.opportunityFindFirst.mockResolvedValue(null);

    const response = await POST(request(), {
      params: Promise.resolve({ id: "opp_123" }),
    });

    expect(response.status).toBe(404);
    const where = mocks.opportunityFindFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      status: "APPROVED",
      publishedAt: { not: null },
      applicationDeadline: { gt: expect.any(Date) },
      closedAt: null,
    });
    }
  );

  it("creates a schema-supported initial application using authenticated identity", async () => {
    const response = await POST(
      request({ message: "I am interested in this role.", resumeUrl: "https://example.com/resume" }),
      { params: Promise.resolve({ id: "opp_123" }) }
    );
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.applicationCreate).toHaveBeenCalledWith({
      data: {
        opportunityId: "opp_123",
        studentId: "student_db_123",
        message: "I am interested in this role.",
        resumeUrl: "https://example.com/resume",
        status: "APPLIED",
      },
      select: { id: true, status: true, appliedAt: true },
    });
    expect(result.application.status).toBe("APPLIED");
  });

  it("returns 409 for the existing unique application constraint", async () => {
    mocks.applicationCreate.mockRejectedValue(
      Object.assign(new Error("unique constraint"), { code: "P2002" })
    );

    const response = await POST(request(), {
      params: Promise.resolve({ id: "opp_123" }),
    });

    expect(response.status).toBe(409);
    expect(mocks.applicationCreate).toHaveBeenCalledOnce();
  });

  it("rejects forged student identity and application status fields", async () => {
    const response = await POST(
      request({ studentId: "attacker", status: "SELECTED" }),
      { params: Promise.resolve({ id: "opp_123" }) }
    );

    expect(response.status).toBe(400);
    expect((await response.json()).errors).toMatchObject({
      studentId: "This field is not accepted.",
      status: "This field is not accepted.",
    });
    expect(mocks.applicationCreate).not.toHaveBeenCalled();
  });

  it.each([
    [{ message: 123 }],
    [{ message: "x".repeat(5_001) }],
    [{ resumeUrl: "javascript:alert(1)" }],
    [{ resumeUrl: "data:text/html,unsafe" }],
    [{ unexpected: "value" }],
  ])("rejects invalid application input %o", async (body) => {
    const response = await POST(request(body), {
      params: Promise.resolve({ id: "opp_123" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.applicationCreate).not.toHaveBeenCalled();
  });

  it("returns a generic error when application persistence fails", async () => {
    mocks.applicationCreate.mockRejectedValue(
      new Error("private SQL and connection details")
    );

    const response = await POST(request(), {
      params: Promise.resolve({ id: "opp_123" }),
    });
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(responseText).toContain("Application could not be submitted.");
    expect(responseText).not.toContain("private SQL and connection details");
  });
});
