import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), userFindFirst: vi.fn(), conversationFindMany: vi.fn(), conversationCount: vi.fn(), conversationUpsert: vi.fn(), conversationUpdate: vi.fn(), messageCreate: vi.fn(), transaction: vi.fn(), connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUniversityUser: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: mocks.userFindFirst }, conversation: { findMany: mocks.conversationFindMany, count: mocks.conversationCount, upsert: mocks.conversationUpsert, update: mocks.conversationUpdate }, directMessage: { create: mocks.messageCreate }, $transaction: mocks.transaction } }));
vi.mock("next/server", () => ({ connection: mocks.connection }));
import { GET, POST } from "./route";

const user = { id: "student-1", universityId: "uni-1", primaryRole: "STUDENT", secondaryRoles: [] };

describe("/api/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.connection.mockResolvedValue(undefined); mocks.auth.mockResolvedValue({ user });
    mocks.userFindFirst.mockResolvedValue({ id: "student-2" }); mocks.conversationUpsert.mockResolvedValue({ id: "conversation-1" });
    mocks.messageCreate.mockResolvedValue({ id: "message-1", content: "Hello", createdAt: new Date(), conversationId: "conversation-1" });
    mocks.conversationUpdate.mockResolvedValue({});
    mocks.transaction.mockImplementation((work) => work({ conversation: { upsert: mocks.conversationUpsert, update: mocks.conversationUpdate }, directMessage: { create: mocks.messageCreate } }));
  });

  it("requires authentication before listing conversations", async () => {
    mocks.auth.mockResolvedValue({ response: Response.json({ message: "Authentication required" }, { status: 401 }) });
    const response = await GET(new Request("http://localhost/api/messages"));
    expect(response.status).toBe(401); expect(mocks.conversationFindMany).not.toHaveBeenCalled();
  });

  it("creates the conversation and message using only the authenticated sender", async () => {
    const response = await POST(new Request("http://localhost/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientId: "student-2", content: "Hello", senderId: "forged" }) }));
    expect(response.status).toBe(400);
    const valid = await POST(new Request("http://localhost/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientId: "student-2", content: "Hello" }) }));
    expect(valid.status).toBe(201);
    expect(mocks.userFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "student-2", universityId: "uni-1" }) }));
    expect(mocks.messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ senderId: "student-1", content: "Hello" }) }));
  });

  it("does not create a conversation for a recipient outside the university", async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientId: "other-university-user", content: "Hello" }) }));
    expect(response.status).toBe(404); expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
