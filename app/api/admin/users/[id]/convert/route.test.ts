import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireWritableUniversityRoles: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

import { requireWritableUniversityRoles } from "@/lib/auth";
import { POST } from "./route";

describe("prospective student conversion", () => {
  it("requires administrator authorization", async () => {
    vi.mocked(requireWritableUniversityRoles).mockResolvedValue({
      response: Response.json(
        { success: false, message: "Administrator access is required." },
        { status: 403 }
      ),
    });

    const response = await POST(
      new Request("http://localhost/api/admin/users/u1/convert", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ id: "u1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("rejects conversion without an institutional ID", async () => {
    vi.mocked(requireWritableUniversityRoles).mockResolvedValue({
      user: {
        id: "admin",
        universityId: "university",
        secondaryRoles: [{ role: "ADMINISTRATOR" }],
      } as never,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/users/u1/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "u1" }) }
    );

    expect(response.status).toBe(400);
  });
});