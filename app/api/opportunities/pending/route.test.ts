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

import { GET as getPending } from "./route";
import { GET as getReviewed } from "../reviewed/route";

const user = {
  id: "admin_db_1",
  universityId: "university_1",
  primaryRole: "FACULTY",
  secondaryRoles: [{ role: "ADMINISTRATOR" }],
};
const pendingUrl = "http://localhost/api/opportunities/pending";

function authFailure(status: number) {
  return { response: Response.json({ success: false }, { status }) };
}

describe("administrator opportunity queues", () => {
  beforeEach(() => {
    mocks.connection.mockResolvedValue(undefined);
    mocks.requireUniversityUser.mockResolvedValue({ user });
    mocks.opportunityFindMany.mockResolvedValue([]);
    mocks.opportunityCount.mockResolvedValue(0);
  });

  it("loads the database pending queue only for a secondary-role administrator", async () => {
    const request = new Request(`${pendingUrl}?page=2&limit=10`);
    const response = await getPending(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.requireUniversityUser).toHaveBeenCalledWith(request);
    expect(mocks.opportunityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        universityId: "university_1",
        status: "PENDING",
        submitter: { is: { universityId: "university_1" } },
      },
      skip: 10,
      take: 10,
      select: expect.objectContaining({
        status: true,
        createdAt: true,
        submitter: { select: { fullName: true } },
        approvalHistory: expect.objectContaining({ take: 1 }),
      }),
    }));
    expect(mocks.opportunityCount).toHaveBeenCalledWith({
      where: mocks.opportunityFindMany.mock.calls[0][0].where,
    });
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 0, totalPages: 0 });
  });

  it("loads approved and rejected records and their latest approval records for admin tabs", async () => {
    const response = await getReviewed(new Request("http://localhost/api/opportunities/reviewed"));

    expect(response.status).toBe(200);
    expect(mocks.opportunityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        universityId: "university_1",
        status: { in: ["APPROVED", "REJECTED"] },
        submitter: { is: { universityId: "university_1" } },
      },
      select: expect.objectContaining({
        approvalHistory: {
          orderBy: { reviewedAt: "desc" },
          take: 1,
          select: { decision: true, reason: true, reviewedAt: true },
        },
      }),
    }));
  });

  it.each(["APPROVED", "REJECTED"]) ("can load only the %s administrator history", async (status) => {
    const response = await getReviewed(new Request(`http://localhost/api/opportunities/reviewed?status=${status}`));
    expect(response.status).toBe(200);
    expect(mocks.opportunityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status,
        universityId: "university_1",
        submitter: { is: { universityId: "university_1" } },
      }),
    }));
  });

  it("rejects an invalid reviewed status", async () => {
    const response = await getReviewed(new Request("http://localhost/api/opportunities/reviewed?status=PENDING"));
    expect(response.status).toBe(400);
    expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
  });

  it.each([
    ["student", { ...user, primaryRole: "STUDENT", secondaryRoles: [] }],
    ["unrelated secondary role", { ...user, secondaryRoles: [{ role: "MENTOR" }] }],
  ])("rejects %s without the database-backed Administrator secondary role", async (_label, unauthorizedUser) => {
    mocks.requireUniversityUser.mockResolvedValue({ user: unauthorizedUser });
    const response = await getPending(new Request(pendingUrl));
    expect(response.status).toBe(403);
    expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
  });

  it("preserves unauthenticated and no-university responses", async () => {
    mocks.requireUniversityUser.mockResolvedValue(authFailure(401));
    expect((await getPending(new Request(pendingUrl))).status).toBe(401);
    mocks.requireUniversityUser.mockResolvedValue(authFailure(403));
    expect((await getPending(new Request(pendingUrl))).status).toBe(403);
    expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
  });

  it("rejects invalid or unsupported pagination parameters", async () => {
    for (const query of ["?page=0", "?limit=51", "?limit=bad", "?page=1&page=2", "?universityId=other"]) {
      expect((await getPending(new Request(`${pendingUrl}${query}`))).status).toBe(400);
    }
    expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
  });

  it("returns generic errors when queue persistence fails", async () => {
    mocks.opportunityFindMany.mockRejectedValue(new Error("private database details"));
    const response = await getPending(new Request(pendingUrl));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database details");
  });
});
