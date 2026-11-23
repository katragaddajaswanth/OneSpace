import { requireUniversityUser, requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, pageInfo, parsePage, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { conversationId } = await context.params;
    const page = parsePage(request.url, 30, 100);
    if (!page) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, OR: [{ userAId: auth.user.id }, { userBId: auth.user.id }], userA: { universityId: auth.user.universityId }, userB: { universityId: auth.user.universityId } }, select: { id: true } });
    if (!conversation) return apiJson({ success: false, message: "Conversation not found." }, 404);
    const where = { conversationId, conversation: { OR: [{ userAId: auth.user.id }, { userBId: auth.user.id }], userA: { universityId: auth.user.universityId }, userB: { universityId: auth.user.universityId } } };
    const [messages, total] = await Promise.all([prisma.directMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.limit, select: { id: true, senderId: true, content: true, createdAt: true, readAt: true } }), prisma.directMessage.count({ where })]);
    await prisma.directMessage.updateMany({ where: { conversationId, senderId: { not: auth.user.id }, readAt: null }, data: { readAt: new Date() } });
    return apiJson({ success: true, messages: messages.reverse(), pagination: pageInfo(page.page, page.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Messages could not be loaded." }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const { conversationId } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["content"]);
    if (invalid) return invalid;
    const content = requiredText(parsed.body, "content", 4000);
    if (!content) return apiJson({ success: false, message: "Message is required." }, 400);
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, OR: [{ userAId: auth.user.id }, { userBId: auth.user.id }], userA: { universityId: auth.user.universityId }, userB: { universityId: auth.user.universityId } }, select: { id: true } });
    if (!conversation) return apiJson({ success: false, message: "Conversation not found." }, 404);
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.directMessage.create({ data: { conversationId, senderId: auth.user.id, content }, select: { id: true, content: true, createdAt: true, senderId: true } });
      await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return created;
    });
    return apiJson({ success: true, message }, 201);
  } catch {
    return apiJson({ success: false, message: "Message could not be sent." }, 500);
  }
}
