import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUniversityRoles: vi.fn(),
  opportunityUpdateMany: vi.fn(),
  opportunityFindUnique: vi.fn(),
  approvalCreate: vi.fn(),
  transaction: vi.fn(),
  connection: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUniversityRoles: mocks.requireUniversityRoles,
  requireWritableUniversityRoles: async (allowedRoles: readonly string[], message: string, req: Request) => {
    // delegate to requireUniversityRoles mock to simulate auth
    const result = await mocks.requireUniversityRoles(allowedRoles, message, req);
    if (result.response) return result;
    return { user: result.user };
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("next/server", () => ({ connection: mocks.connection }));

import { PATCH } from "./route";

const endpoint = "http://localhost/api/opportunities/opp_123/approval";
const reviewer = {
  id: "reviewer_db_123",
  universityId: "university_db_123",
  primaryRole: "FACULTY",
  secondaryRoles: [{ role: "ADMINISTRATOR" }],
};

function request(body: unknown) {
  return new Request(endpoint, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authFailure(status: number, message: string) {
  return {
    response: Response.json({ success: false, message }, { status }),
  };
}

describe("PATCH /api/opportunities/[id]/approval", () => {
  beforeEach(() => {
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUniversityRoles.mockResolvedValue({ user: reviewer });
    mocks.opportunityUpdateMany.mockResolvedValue({ count: 1 });
    mocks.opportunityFindUnique.mockResolvedValue({
      universityId: "university_db_123",
      status: "APPROVED",
      submitter: { universityId: "university_db_123" },
    });
    mocks.approvalCreate.mockResolvedValue({ id: "approval_123" });
    mocks.transaction.mockImplementation((callback) =>
      callback({
        opportunity: {
          updateMany: mocks.opportunityUpdateMany,
          findUnique: mocks.opportunityFindUnique,
        },
        opportunityApproval: { create: mocks.approvalCreate },
      })
    );
  });

  it("approves a pending opportunity and records the database-backed reviewer", async () => {
    const response = await PATCH(request({ decision: "APPROVE" }), {
      params: Promise.resolve({ id: "opp_123" }),
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requireUniversityRoles).toHaveBeenCalledWith(
      ["ADMINISTRATOR"],
      expect.any(String),
      expect.any(Request)
    );
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.opportunityUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "opp_123",
          status: "PENDING",
          universityId: "university_db_123",
          submitter: { is: { universityId: "university_db_123" } },
        },
        data: expect.objectContaining({
          status: "APPROVED",
          publishedAt: expect.any(Date),
        }),
      })
    );
    expect(mocks.approvalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        opportunityId: "opp_123",
        reviewerId: "reviewer_db_123",
        decision: "APPROVED",
        reason: null,
        reviewedAt: expect.any(Date),
      }),
    });
    expect(result.opportunity.status).toBe("APPROVED");
    expect(result.opportunity.publishedAt).toBeTruthy();
    expect(result).not.toHaveProperty("kind");
  });

  it("rejects a pending opportunity with its meaningful reason without publishing it", async () => {
    const response = await PATCH(
      request({ decision: "REJECT", reason: "Eligibility details are incomplete." }),
      { params: Promise.resolve({ id: "opp_123" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.opportunityUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REJECTED" } })
    );
    expect(mocks.approvalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewerId: "reviewer_db_123",
        decision: "REJECTED",
        reason: "Eligibility details are incomplete.",
      }),
    });
    expect((await response.json()).opportunity).not.toHaveProperty("publishedAt");
  });

  it("requires a meaningful reason when rejecting", async () => {
    const response = await PATCH(
      request({ decision: "REJECT", reason: "  no  " }),
      { params: Promise.resolve({ id: "opp_123" }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns 403 when the user lacks the administrator secondary role", async () => {
    mocks.requireUniversityRoles.mockResolvedValue(
      authFailure(403, "Administrator access is required.")
    );

    const response = await PATCH(request({ decision: "APPROVE" }), {
      params: Promise.resolve({ id: "opp_123" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.requireUniversityRoles.mockResolvedValue(
      authFailure(401, "Authentication required.")
    );

    const response = await PATCH(request({ decision: "APPROVE" }), {
      params: Promise.resolve({ id: "opp_123" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["opportunity", "another_university", "university_db_123"],
    ["submitter", "university_db_123", "another_university"],
  ])("rejects an opportunity with a cross-university %s", async (_kind, opportunityUniversityId, submitterUniversityId) => {
    mocks.opportunityUpdateMany.mockResolvedValue({ count: 0 });
    mocks.opportunityFindUnique.mockResolvedValue({
      universityId: opportunityUniversityId,
      status: "PENDING",
      submitter: { universityId: submitterUniversityId },
    });

    const response = await PATCH(request({ decision: "APPROVE" }), {
      params: Promise.resolve({ id: "opp_123" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.approvalCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when the opportunity does not exist", async () => {
    mocks.opportunityUpdateMany.mockResolvedValue({ count: 0 });
    mocks.opportunityFindUnique.mockResolvedValue(null);

    const response = await PATCH(request({ decision: "APPROVE" }), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.approvalCreate).not.toHaveBeenCalled();
  });

  it("returns 409 for an opportunity that is no longer pending", async () => {
    mocks.opportunityUpdateMany.mockResolvedValue({ count: 0 });
    mocks.opportunityFindUnique.mockResolvedValue({
      universityId: "university_db_123",
      status: "APPROVED",
      submitter: { universityId: "university_db_123" },
    });

    const response = await PATCH(request({ decision: "REJECT", reason: "No longer eligible." }), {
      params: Promise.resolve({ id: "opp_123" }),
    });

    expect(response.status).toBe(409);
    expect(mocks.approvalCreate).not.toHaveBeenCalled();
  });

  it("prevents a repeated review from creating a second decision", async () => {
    let currentStatus = "PENDING";
    mocks.opportunityUpdateMany.mockImplementation(async ({ where, data }) => {
      if (currentStatus !== where.status) return { count: 0 };
      currentStatus = data.status;
      return { count: 1 };
    });
    mocks.opportunityFindUnique.mockImplementation(async () => ({
      universityId: "university_db_123",
      status: currentStatus,
      submitter: { universityId: "university_db_123" },
    }));

    const first = await PATCH(request({ decision: "APPROVE" }), {
      params: Promise.resolve({ id: "opp_123" }),
    });
    const second = await PATCH(
      request({ decision: "REJECT", reason: "Insufficient details." }),
      { params: Promise.resolve({ id: "opp_123" }) }
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(mocks.approvalCreate).toHaveBeenCalledOnce();
  });

  it("permits only one decision for repeated and concurrent reviews", async () => {
    let currentStatus = "PENDING";
    mocks.opportunityUpdateMany.mockImplementation(async ({ where, data }) => {
      if (currentStatus !== where.status) return { count: 0 };
      currentStatus = data.status;
      return { count: 1 };
    });
    mocks.opportunityFindUnique.mockImplementation(async () => ({
      universityId: "university_db_123",
      status: currentStatus,
      submitter: { universityId: "university_db_123" },
    }));

    const [first, second] = await Promise.all([
      PATCH(request({ decision: "APPROVE" }), {
        params: Promise.resolve({ id: "opp_123" }),
      }),
      PATCH(request({ decision: "REJECT", reason: "Insufficient details." }), {
        params: Promise.resolve({ id: "opp_123" }),
      }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(mocks.approvalCreate).toHaveBeenCalledOnce();
  });

  it("rejects unexpected reviewer and university fields", async () => {
    const response = await PATCH(
      request({
        decision: "APPROVE",
        reviewerId: "forged-reviewer",
        universityId: "forged-university",
      }),
      { params: Promise.resolve({ id: "opp_123" }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns a generic error when a database operation fails", async () => {
    mocks.approvalCreate.mockRejectedValue(
      new Error("private SQL and database details")
    );

    const response = await PATCH(request({ decision: "APPROVE" }), {
      params: Promise.resolve({ id: "opp_123" }),
    });
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(responseText).toContain("Opportunity review could not be completed.");
    expect(responseText).not.toContain("private SQL and database details");
  });
});
