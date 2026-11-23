import { requireUniversityUser, requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, pageInfo, parsePage, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") return apiJson({ success: false, message: "Community discussions are restricted to enrolled members." }, 403);
    const { id } = await context.params;
    const pagination = parsePage(request.url);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const member = await prisma.communityMembership.findFirst({ where: { communityId: id, userId: auth.user.id, status: "APPROVED", community: { universityId: auth.user.universityId, status: "APPROVED" } }, select: { id: true } });
    const creator = await prisma.community.findFirst({ where: { id, createdById: auth.user.id, universityId: auth.user.universityId, status: "APPROVED" }, select: { id: true } });
    if (!member && !creator) return apiJson({ success: false, message: "Community membership required." }, 403);
    const where = { communityId: id, deletedAt: null };
    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, content: true, createdAt: true, updatedAt: true, author: { select: { id: true, fullName: true, primaryRole: true } } } }),
      prisma.communityPost.count({ where }),
    ]);
    return apiJson({ success: true, posts, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Community discussions could not be loaded." }, 500);
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
    const content = requiredText(parsed.body, "content", 3000);
    if (!content) return apiJson({ success: false, message: "Discussion post must be 1–3000 characters." }, 400);
    const member = await prisma.communityMembership.findFirst({ where: { communityId: id, userId: auth.user.id, status: "APPROVED", community: { universityId: auth.user.universityId, status: "APPROVED" } }, select: { id: true } });
    if (!member) return apiJson({ success: false, message: "Approved community membership is required." }, 403);
    const post = await prisma.communityPost.create({ data: { communityId: id, authorId: auth.user.id, content }, select: { id: true, content: true, createdAt: true } });
    return apiJson({ success: true, post }, 201);
  } catch {
    return apiJson({ success: false, message: "Discussion post could not be created." }, 500);
  }
}
