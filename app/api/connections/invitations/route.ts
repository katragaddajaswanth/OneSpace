import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, pageInfo, parsePage, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") return apiJson({ success: false, message: "Restricted networking is unavailable to prospective students." }, 403);
    const page = parsePage(request.url, 20, 50);
    if (!page) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const where = { OR: [{ senderId: auth.user.id }, { recipientId: auth.user.id }], sender: { universityId: auth.user.universityId }, recipient: { universityId: auth.user.universityId } };
    const [invitations, total] = await Promise.all([
      prisma.connectionInvitation.findMany({ where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.limit, select: { id: true, status: true, createdAt: true, respondedAt: true, senderId: true, recipientId: true, sender: { select: { id: true, fullName: true } }, recipient: { select: { id: true, fullName: true } }, initialMessage: { select: { content: true, createdAt: true } } } }),
      prisma.connectionInvitation.count({ where }),
    ]);
    return apiJson({ success: true, invitations, pagination: pageInfo(page.page, page.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Connection invitations could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") return apiJson({ success: false, message: "Restricted networking is unavailable to prospective students." }, 403);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["recipientId", "initialMessageId"]);
    if (invalid) return invalid;
    const recipientId = requiredText(parsed.body, "recipientId", 100);
    const initialMessageId = requiredText(parsed.body, "initialMessageId", 100);
    if (!recipientId || !initialMessageId || recipientId === auth.user.id) return apiJson({ success: false, message: "Provide a valid recipient and the ID of a message you already sent." }, 400);
    const recipient = await prisma.user.findFirst({ where: { id: recipientId, universityId: auth.user.universityId, accountStatus: "ACTIVE", emailVerified: true }, select: { id: true } });
    if (!recipient) return apiJson({ success: false, message: "Recipient is unavailable." }, 404);
    const invitation = await prisma.$transaction(async (tx) => {
      const initialMessage = await tx.directMessage.findFirst({ where: { id: initialMessageId, senderId: auth.user.id, conversation: { OR: [{ userAId: auth.user.id, userBId: recipientId }, { userAId: recipientId, userBId: auth.user.id }], userA: { universityId: auth.user.universityId }, userB: { universityId: auth.user.universityId } } }, select: { id: true, conversationId: true } });
      if (!initialMessage) return null;
      const duplicate = await tx.connectionInvitation.findFirst({ where: { senderId: auth.user.id, recipientId, status: "PENDING" }, select: { id: true } });
      if (duplicate) return { duplicate: true as const };
      const existingConnection = await tx.userConnection.findFirst({ where: { OR: [{ userAId: auth.user.id, userBId: recipientId }, { userAId: recipientId, userBId: auth.user.id }] }, select: { id: true } });
      if (existingConnection) return { connected: true as const };
      return tx.connectionInvitation.create({ data: { senderId: auth.user.id, recipientId, conversationId: initialMessage.conversationId, initialMessageId }, select: { id: true, status: true, createdAt: true } });
    });
    if (!invitation) return apiJson({ success: false, message: "Send a personal message to this person before inviting them." }, 400);
    if ("duplicate" in invitation) return apiJson({ success: false, message: "A pending invitation already exists." }, 409);
    if ("connected" in invitation) return apiJson({ success: false, message: "You are already connected." }, 409);
    return apiJson({ success: true, invitation }, 201);
  } catch {
    return apiJson({ success: false, message: "Connection invitation could not be sent." }, 500);
  }
}
