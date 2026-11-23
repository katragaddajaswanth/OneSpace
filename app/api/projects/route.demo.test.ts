import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  writableAuth: vi.fn(),
  projectCreate: vi.fn(),
  projectMemberCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireWritableUniversity: mocks.writableAuth,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";

describe("demo read-only project mutation protection", () => {
  beforeEach(() => {
    mocks.writableAuth.mockReset();
    mocks.projectCreate.mockReset();
    mocks.projectMemberCreate.mockReset();
    mocks.transaction.mockReset();
  });

  it("returns 403 and does not write for a demo account", async () => {
    mocks.writableAuth.mockResolvedValue({
      response: Response.json(
        { success: false, message: "This is a read-only demonstration account.", code: "DEMO_READ_ONLY" },
        { status: 403 }
      ),
    });

    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Unauthorized demo project",
        description: "Should not be created",
        category: "Test",
        theme: "Test",
        problemStatement: "Test",
      }),
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "DEMO_READ_ONLY" });
    expect(mocks.projectCreate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("preserves real Student project creation", async () => {
    const realUser = {
      id: "student-real",
      primaryRole: "STUDENT",
      universityId: "real-university",
    };
    mocks.writableAuth.mockResolvedValue({ user: realUser });
    mocks.projectCreate.mockResolvedValue({
      id: "project-real",
      title: "Real project",
      status: "DRAFT",
      createdAt: new Date(),
    });
    mocks.projectMemberCreate.mockResolvedValue({ id: "member-real" });
    mocks.transaction.mockImplementation(async (work: (tx: unknown) => unknown) => work({
      project: { create: mocks.projectCreate },
      projectMember: { create: mocks.projectMemberCreate },
    }));

    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Real project",
        description: "A real university project",
        category: "Research",
        theme: "Innovation",
        problemStatement: "A verified real project",
        requiredSkills: ["TypeScript"],
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.projectCreate).toHaveBeenCalledOnce();
  });

  it("keeps existing non-student role restrictions", async () => {
    mocks.writableAuth.mockResolvedValue({
      user: {
        id: "faculty-real",
        primaryRole: "FACULTY",
        universityId: "real-university",
      },
    });

    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Faculty project",
        description: "Should be rejected",
        category: "Research",
        theme: "Innovation",
        problemStatement: "Role restriction",
      }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.projectCreate).not.toHaveBeenCalled();
  });
});
