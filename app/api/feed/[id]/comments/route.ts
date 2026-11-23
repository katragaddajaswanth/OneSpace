import { requireUniversityUser, requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, parsePage, pageInfo, readJsonObject, requiredText, rejectUnexpectedFields } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const pagination = parsePage(request.url);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const post = await prisma.universityPost.findFirst({ where: { id, universityId: auth.user.universityId, status: "APPROVED" }, select: { id: true } });
    if (!post) return apiJson({ success: false, message: "Post not found." }, 404);
    const where = { postId: id, deletedAt: null };
    const [comments, total] = await Promise.all([
      prisma.postComment.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, content: true, createdAt: true, user: { select: { id: true, fullName: true } } } }),
      prisma.postComment.count({ where }),
    ]);
    return apiJson({ success: true, comments, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Comments could not be loaded." }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["content"]);
    if (invalid) return invalid;
    const content = requiredText(parsed.body, "content", 2000);
    if (!content) return apiJson({ success: false, message: "Comment must be 1–2000 characters." }, 400);
    const post = await prisma.universityPost.findFirst({ where: { id, universityId: auth.user.universityId, status: "APPROVED" }, select: { id: true } });
    if (!post) return apiJson({ success: false, message: "Post not found." }, 404);
    const comment = await prisma.postComment.create({ data: { postId: id, userId: auth.user.id, content }, select: { id: true, content: true, createdAt: true } });
    return apiJson({ success: true, comment }, 201);
  } catch {
    return apiJson({ success: false, message: "Comment could not be created." }, 500);
  }
}
