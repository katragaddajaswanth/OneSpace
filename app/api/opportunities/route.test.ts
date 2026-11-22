import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUniversityRoles: vi.fn(),
  requireUniversityUser: vi.fn(),
  opportunityUniversityScope: vi.fn(),
  universityFindFirst: vi.fn(),
  opportunityCreate: vi.fn(),
  opportunityFindMany: vi.fn(),
  opportunityCount: vi.fn(),
  connection: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUniversityRoles: mocks.requireUniversityRoles,
  requireUniversityUser: mocks.requireUniversityUser,
  opportunityUniversityScope: mocks.opportunityUniversityScope,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    university: { findFirst: mocks.universityFindFirst },
    opportunity: {
      create: mocks.opportunityCreate,
      findMany: mocks.opportunityFindMany,
      count: mocks.opportunityCount,
    },
  },
}));

vi.mock("next/server", () => ({ connection: mocks.connection }));

import { GET, POST } from "./route";

const endpoint = "http://localhost/api/opportunities";

function makeUser(
  primaryRole = "ALUMNI",
  secondaryRoles: string[] = []
) {
  return {
    id: "user_db_123",
    universityId: "university_db_123",
    primaryRole,
    secondaryRoles: secondaryRoles.map((role) => ({ role })),
  };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Frontend Developer Intern",
    organization: "Example Labs",
    description: "Build product interfaces with the engineering team.",
    type: "INTERNSHIP",
    compensationType: "PAID",
    location: "Remote",
    workMode: "REMOTE",
    eligibility: "Current university students",
    requiredSkills: "React, TypeScript",
    applicationDeadline: "2099-12-20",
    applicationUrl: "https://example.com/apply",
    ...overrides,
  };
}

function jsonRequest(body: unknown) {
  return new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(query = "") {
  return new Request(`${endpoint}${query}`, { method: "GET" });
}

function authFailure(status: number, message: string) {
  return {
    response: Response.json({ success: false, message }, { status }),
  };
}

describe("/api/opportunities", () => {
  beforeEach(() => {
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUniversityRoles.mockResolvedValue({ user: makeUser() });
    mocks.requireUniversityUser.mockResolvedValue({ user: makeUser("STUDENT") });
    mocks.opportunityUniversityScope.mockImplementation((user) => ({
      universityId: user.universityId,
      submitter: { is: { universityId: user.universityId } },
    }));
    mocks.universityFindFirst.mockResolvedValue({ isActive: true });
    mocks.opportunityCreate.mockImplementation(async ({ data }) => ({
      id: "opportunity_db_123",
      ...data,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }));
    mocks.opportunityFindMany.mockResolvedValue([]);
    mocks.opportunityCount.mockResolvedValue(0);
  });

  it("authorizes students by their primary role and requires university membership", async () => {
    const request = getRequest();
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.requireUniversityUser).toHaveBeenCalledWith(request);
    expect(mocks.opportunityUniversityScope).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user_db_123",
        universityId: "university_db_123",
        primaryRole: "STUDENT",
      })
    );
  });

  it.each([
    ["Alumni", makeUser("ALUMNI")],
    [
      "Industry Representatives",
      makeUser("ALUMNI", ["INDUSTRY_REPRESENTATIVE"]),
    ],
    ["Faculty", makeUser("FACULTY")],
  ])("rejects %s from student discovery", async (_label, user) => {
    mocks.requireUniversityUser.mockResolvedValue({ user });

    const response = await GET(getRequest());

    expect(response.status).toBe(403);
    expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
  });

  it("returns the authentication helper response when no university member is signed in", async () => {
    mocks.requireUniversityUser.mockResolvedValue(
      authFailure(401, "Authentication required.")
    );

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
  });

  it("constrains the query to the authenticated user's university and submitter university", async () => {
    await GET(getRequest());

    const query = mocks.opportunityFindMany.mock.calls[0][0];
    expect(query.where).toMatchObject({
      universityId: "university_db_123",
      submitter: { is: { universityId: "university_db_123" } },
    });
  });

  it("includes only approved, published, unexpired opportunities", async () => {
    await GET(getRequest());

    const query = mocks.opportunityFindMany.mock.calls[0][0];
    expect(query.where.status).toBe("APPROVED");
    expect(query.where.publishedAt).toEqual({ not: null });
    expect(query.where.applicationDeadline.gt).toBeInstanceOf(Date);
    expect(query.where.applicationDeadline.gt.getTime()).toBeGreaterThan(0);
  });

  it("applies search across discovery text fields and enum filters", async () => {
    await GET(
      getRequest(
        "?search=react&type=INTERNSHIP&workMode=REMOTE&compensationType=PAID"
      )
    );

    const where = mocks.opportunityFindMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { title: { contains: "react", mode: "insensitive" } },
      { organization: { contains: "react", mode: "insensitive" } },
      { description: { contains: "react", mode: "insensitive" } },
      { requiredSkills: { contains: "react", mode: "insensitive" } },
    ]);
    expect(where.type).toBe("INTERNSHIP");
    expect(where.workMode).toBe("REMOTE");
    expect(where.compensationType).toBe("PAID");
  });

  it("returns paginated results and total count", async () => {
    mocks.opportunityFindMany.mockResolvedValue([{ id: "opp_1" }]);
    mocks.opportunityCount.mockResolvedValue(21);

    const response = await GET(getRequest("?page=2&limit=5"));
    const result = await response.json();

    expect(mocks.opportunityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 })
    );
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 21,
      totalPages: 5,
    });
    expect(result.opportunities).toEqual([{ id: "opp_1" }]);
  });

  it("uses page 1 and limit 12 by default", async () => {
    const response = await GET(getRequest());
    const result = await response.json();

    expect(mocks.opportunityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 12 })
    );
    expect(result.pagination).toMatchObject({ page: 1, limit: 12 });
  });

  it("ignores recognized tracking parameters without adding them to database filters", async () => {
    const query = "?page=2&limit=5&utm_source=newsletter&utm_medium=email&utm_campaign=spring&utm_term=internship&utm_content=hero&utm_id=campaign-1&gclid=click-1&fbclid=click-2&UTM_SOURCE=duplicate";
    const response = await GET(getRequest(query));

    expect(response.status).toBe(200);
    expect(mocks.opportunityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 5,
      take: 5,
      where: {
        universityId: "university_db_123",
        submitter: { is: { universityId: "university_db_123" } },
        status: "APPROVED",
        publishedAt: { not: null },
        applicationDeadline: { gt: expect.any(Date) },
      },
    }));
    expect(mocks.opportunityCount.mock.calls[0][0].where).not.toHaveProperty("utm_source");
    expect(mocks.opportunityFindMany.mock.calls[0][0].where).not.toHaveProperty("gclid");
  });

  it.each([
    ["newest", { createdAt: "desc" }],
    ["oldest", { createdAt: "asc" }],
    ["deadline", { applicationDeadline: "asc" }],
  ])("sorts by %s", async (sort, firstOrder) => {
    await GET(getRequest(`?sort=${sort}`));

    expect(mocks.opportunityFindMany.mock.calls[0][0].orderBy[0]).toEqual(
      firstOrder
    );
  });

  it.each([
    "?type=INVALID",
    "?workMode=INVALID",
    "?compensationType=INVALID",
    "?page=0",
    "?page=1.5",
    "?limit=51",
    "?sort=random",
    "?search=%20%20%20",
    "?universityId=attacker-controlled",
    "?utm_referrer=unknown-tracking-key",
    "?unsupported=value",
    "?page=1&page=2",
  ])("rejects invalid query string %s", async (query) => {
    const response = await GET(getRequest(query));

    expect(response.status).toBe(400);
    expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
  });

  it("returns a generic response when a discovery query fails", async () => {
    mocks.opportunityFindMany.mockRejectedValue(
      new Error("internal SQL and connection details")
    );

    const response = await GET(getRequest());
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(responseText).toContain("Opportunities could not be loaded.");
    expect(responseText).not.toContain("internal SQL and connection details");
  });

  it.each(["findMany", "count"])("identifies a development failure in the Prisma %s operation", async (operation) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = () => { throw new TypeError("Prisma operation failed"); };
    if (operation === "findMany") mocks.opportunityFindMany.mockImplementation(failure);
    else mocks.opportunityCount.mockImplementation(failure);

    try {
      const response = await GET(getRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.diagnostic).toMatchObject({
        endpoint: "GET /api/opportunities",
        stage: operation === "findMany" ? "prisma_findMany" : "prisma_count",
        errorName: "TypeError",
        message: "Prisma operation failed",
      });
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  });

  it("selects only discovery fields", async () => {
    await GET(getRequest());

    const selection = mocks.opportunityFindMany.mock.calls[0][0].select;
    expect(selection).toMatchObject({
      id: true,
      title: true,
      organization: true,
      description: true,
      type: true,
      publishedAt: true,
    });
    expect(selection).not.toHaveProperty("submittedById");
    expect(selection).not.toHaveProperty("universityId");
    expect(selection).not.toHaveProperty("approvalHistory");
  });

  it("authorizes Alumni through the primary role", async () => {
    const request = jsonRequest(validBody());
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mocks.requireUniversityRoles).toHaveBeenCalledWith(
      ["ALUMNI", "INDUSTRY_REPRESENTATIVE"],
      expect.any(String),
      request
    );
    expect(mocks.opportunityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ submitterRole: "ALUMNI" }),
      })
    );
  });

  it("authorizes Industry Representatives through the secondary role", async () => {
    mocks.requireUniversityRoles.mockResolvedValue({
      user: makeUser("STUDENT", ["INDUSTRY_REPRESENTATIVE"]),
    });

    const response = await POST(jsonRequest(validBody()));

    expect(response.status).toBe(201);
    expect(mocks.opportunityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submitterRole: "INDUSTRY_REPRESENTATIVE",
        }),
      })
    );
  });

  it("records Alumni when both allowed roles are assigned", async () => {
    mocks.requireUniversityRoles.mockResolvedValue({
      user: makeUser("ALUMNI", ["INDUSTRY_REPRESENTATIVE"]),
    });

    const response = await POST(jsonRequest(validBody()));

    expect(response.status).toBe(201);
    expect(mocks.opportunityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ submitterRole: "ALUMNI" }),
      })
    );
  });

  it("returns 401 for unauthenticated requests", async () => {
    mocks.requireUniversityRoles.mockResolvedValue(
      authFailure(401, "Authentication required.")
    );

    const response = await POST(jsonRequest(validBody()));

    expect(response.status).toBe(401);
    expect(mocks.universityFindFirst).not.toHaveBeenCalled();
  });

  it("returns 403 for unauthorized roles", async () => {
    mocks.requireUniversityRoles.mockResolvedValue(
      authFailure(403, "Only alumni and industry representatives may submit opportunities.")
    );

    const response = await POST(jsonRequest(validBody()));

    expect(response.status).toBe(403);
    expect(mocks.opportunityCreate).not.toHaveBeenCalled();
  });

  it("returns 403 when university membership is missing", async () => {
    mocks.requireUniversityRoles.mockResolvedValue(
      authFailure(403, "University membership is required.")
    );

    const response = await POST(jsonRequest(validBody()));

    expect(response.status).toBe(403);
    expect(mocks.universityFindFirst).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated university is inactive", async () => {
    mocks.universityFindFirst.mockResolvedValue({ isActive: false });

    const response = await POST(jsonRequest(validBody()));

    expect(response.status).toBe(403);
    expect(mocks.opportunityCreate).not.toHaveBeenCalled();
  });

  it("rejects forged identity, role, and status fields", async () => {
    const response = await POST(
      jsonRequest(
        validBody({
          userId: "attacker",
          universityId: "other-university",
          submitterRole: "INDUSTRY_REPRESENTATIVE",
          status: "APPROVED",
        })
      )
    );

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.errors).toMatchObject({
      userId: "This field is not accepted.",
      universityId: "This field is not accepted.",
      submitterRole: "This field is not accepted.",
      status: "This field is not accepted.",
    });
    expect(mocks.opportunityCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid opportunity enum values", async () => {
    const response = await POST(jsonRequest(validBody({ type: "UNKNOWN" })));

    expect(response.status).toBe(400);
    expect((await response.json()).errors.type).toBe(
      "Select a valid opportunity type."
    );
  });

  it("rejects impossible calendar dates", async () => {
    const response = await POST(
      jsonRequest(validBody({ applicationDeadline: "2099-02-30T12:00:00Z" }))
    );

    expect(response.status).toBe(400);
    expect((await response.json()).errors.applicationDeadline).toBe(
      "Enter a valid date and time."
    );
  });

  it("accepts future ISO deadlines with timezone offsets", async () => {
    const deadline = "2099-12-20T23:30:00-05:00";
    const response = await POST(
      jsonRequest(validBody({ applicationDeadline: deadline }))
    );

    expect(response.status).toBe(201);
    expect(mocks.opportunityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationDeadline: new Date(deadline),
        }),
      })
    );
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"])(
    "rejects unsafe application URL %s",
    async (applicationUrl) => {
      const response = await POST(
        jsonRequest(validBody({ applicationUrl }))
      );

      expect(response.status).toBe(400);
      expect((await response.json()).errors.applicationUrl).toBe(
        "Enter a valid HTTP or HTTPS URL."
      );
    }
  );

  it("returns 413 for an oversized streamed body without Content-Length", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32 * 1024 + 1));
        controller.close();
      },
    });
    const request = new Request(endpoint, {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(mocks.opportunityCreate).not.toHaveBeenCalled();
  });

  it("creates only a PENDING opportunity using the authenticated user's IDs", async () => {
    const response = await POST(jsonRequest(validBody()));
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.opportunity.status).toBe("PENDING");
    expect(mocks.universityFindFirst).toHaveBeenCalledWith({
      where: {
        id: "university_db_123",
        users: { some: { id: "user_db_123" } },
      },
      select: { isActive: true },
    });
    expect(mocks.opportunityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submittedById: "user_db_123",
          universityId: "university_db_123",
          status: "PENDING",
        }),
      })
    );
    const createArgs = mocks.opportunityCreate.mock.calls[0][0];
    expect(createArgs.data).not.toHaveProperty("publishedAt");
    expect(createArgs.data).not.toHaveProperty("approvalHistory");
  });

  it("returns a generic error when the database write fails", async () => {
    mocks.opportunityCreate.mockRejectedValue(
      new Error("sensitive database connection details")
    );

    const response = await POST(jsonRequest(validBody()));
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(responseText).toContain("Opportunity submission could not be completed.");
    expect(responseText).not.toContain("sensitive database connection details");
  });
});
