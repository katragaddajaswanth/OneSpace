import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), userFindFirst: vi.fn(), transaction: vi.fn(), connection: vi.fn(), invitationFindFirst: vi.fn(), userConnectionFindFirst: vi.fn(), invitationCreate: vi.fn(), messageFindFirst: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUniversityUser: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: mocks.userFindFirst }, $transaction: mocks.transaction } }));
vi.mock("next/server", () => ({ connection: mocks.connection }));
import { POST } from "./route";

describe("/api/connections/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.connection.mockResolvedValue(undefined); mocks.auth.mockResolvedValue({ user: { id: "user-a", universityId: "uni-a" } }); mocks.userFindFirst.mockResolvedValue({ id: "user-b" });
    mocks.messageFindFirst.mockResolvedValue(null); mocks.invitationFindFirst.mockResolvedValue(null); mocks.userConnectionFindFirst.mockResolvedValue(null); mocks.invitationCreate.mockResolvedValue({ id: "invite-1" });
    mocks.transaction.mockImplementation((work) => work({ directMessage: { findFirst: mocks.messageFindFirst }, connectionInvitation: { findFirst: mocks.invitationFindFirst, create: mocks.invitationCreate }, userConnection: { findFirst: mocks.userConnectionFindFirst } }));
  });

  it("requires a message sent by the authenticated user before invitation", async () => {
    const response = await POST(new Request("http://localhost/api/connections/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientId: "user-b", initialMessageId: "not-a-message" }) }));
    expect(response.status).toBe(400); expect(mocks.messageFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "not-a-message", senderId: "user-a" }) }));
  });

  it("rejects cross-university recipients", async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/connections/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientId: "foreign", initialMessageId: "msg" }) }));
    expect(response.status).toBe(404); expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
