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
    const where = { OR: [{ userAId: auth.user.id }, { userBId: auth.user.id }], userA: { universityId: auth.user.universityId }, userB: { universityId: auth.user.universityId } };
    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({ where, orderBy: { updatedAt: "desc" }, skip: page.skip, take: page.limit, select: { id: true, updatedAt: true, userAId: true, userBId: true, userA: { select: { id: true, fullName: true } }, userB: { select: { id: true, fullName: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, senderId: true, content: true, createdAt: true, readAt: true } } } }),
      prisma.conversation.count({ where }),
    ]);
    return apiJson({ success: true, conversations: conversations.map(({ userAId, userBId, ...item }) => ({ ...item, peer: userAId === auth.user.id ? item.userB : item.userA, userA: undefined, userB: undefined })), pagination: pageInfo(page.page, page.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Conversations could not be loaded." }, 500);
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
    const invalid = rejectUnexpectedFields(parsed.body, ["recipientId", "content"]);
    if (invalid) return invalid;
    const recipientId = requiredText(parsed.body, "recipientId", 100);
    const content = requiredText(parsed.body, "content", 4000);
    if (!recipientId || !content) return apiJson({ success: false, message: "Recipient and message are required." }, 400);
    if (recipientId === auth.user.id) return apiJson({ success: false, message: "You cannot message yourself." }, 400);
    const recipient = await prisma.user.findFirst({ where: { id: recipientId, universityId: auth.user.universityId, accountStatus: "ACTIVE", emailVerified: true }, select: { id: true } });
    if (!recipient) return apiJson({ success: false, message: "Recipient is unavailable." }, 404);
    const [userAId, userBId] = [auth.user.id, recipient.id].sort();
    const message = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.upsert({ where: { userAId_userBId: { userAId, userBId } }, create: { userAId, userBId }, update: {}, select: { id: true } });
      const created = await tx.directMessage.create({ data: { conversationId: conversation.id, senderId: auth.user.id, content }, select: { id: true, content: true, createdAt: true, conversationId: true } });
      await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      return created;
    });
    return apiJson({ success: true, message }, 201);
  } catch {
    return apiJson({ success: false, message: "Message could not be sent." }, 500);
  }
}
