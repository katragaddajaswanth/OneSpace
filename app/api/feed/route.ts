import { requireUniversityUser, requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, pageInfo, parsePage, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

function validAttachments(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 4 && value.every((item) => {
    if (typeof item !== "string" || item.length > 2048) return false;
    try { const url = new URL(item); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
  });
}

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const pagination = parsePage(request.url);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const connections = await prisma.userConnection.findMany({
      where: { OR: [{ userAId: auth.user.id }, { userBId: auth.user.id }] },
      select: { userAId: true, userBId: true },
    });
    const peers = connections.map((item) => item.userAId === auth.user.id ? item.userBId : item.userAId);
    const visibilityWhere = {
      OR: [
        { authorId: auth.user.id },
        { visibility: "UNIVERSITY" as const },
        { visibility: "CONNECTIONS" as const, authorId: { in: peers } },
      ],
    };
    const where = { universityId: auth.user.universityId, status: "APPROVED" as const, ...visibilityWhere };
    const [posts, total] = await Promise.all([
      prisma.universityPost.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: pagination.skip, take: pagination.limit,
        select: {
          id: true, content: true, attachments: true, visibility: true, sharedPostId: true, createdAt: true,
          author: { select: { id: true, fullName: true, primaryRole: true, unifiedProfile: { select: { photoUrl: true } } } },
          _count: { select: { likes: { where: { removedAt: null } }, comments: { where: { deletedAt: null } } } },
          likes: { where: { userId: auth.user.id, removedAt: null }, select: { id: true }, take: 1 },
          comments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, content: true, createdAt: true, user: { select: { id: true, fullName: true } } } },
        },
      }),
      prisma.universityPost.count({ where }),
    ]);
    return apiJson({ success: true, posts: posts.map((post) => ({ ...post, likedByMe: post.likes.length > 0, likes: undefined })), pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Feed could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["content", "attachments", "visibility", "sharedPostId"]);
    if (invalid) return invalid;
    const content = requiredText(parsed.body, "content", 5000);
    const attachments = parsed.body.attachments ?? [];
    const visibility = parsed.body.visibility ?? "UNIVERSITY";
    if (!content && !validAttachments(attachments)) return apiJson({ success: false, message: "Provide post text or valid attachments." }, 400);
    if (!content && (attachments as unknown[]).length === 0) return apiJson({ success: false, message: "Provide post text or an attachment." }, 400);
    if (parsed.body.content !== undefined && !content) return apiJson({ success: false, errors: { content: "Post text must be 1–5000 characters." } }, 400);
    if (!validAttachments(attachments)) return apiJson({ success: false, errors: { attachments: "Provide up to 4 HTTP or HTTPS attachment links." } }, 400);
    if (!["UNIVERSITY", "CONNECTIONS", "PRIVATE"].includes(String(visibility))) return apiJson({ success: false, message: "Unsupported post visibility." }, 400);
    let sharedPostId: string | null = null;
    if (parsed.body.sharedPostId !== undefined) {
      if (typeof parsed.body.sharedPostId !== "string") return apiJson({ success: false, message: "Invalid shared post." }, 400);
      const shared = await prisma.universityPost.findFirst({ where: { id: parsed.body.sharedPostId, universityId: auth.user.universityId, status: "APPROVED" }, select: { id: true } });
      if (!shared) return apiJson({ success: false, message: "Post is unavailable." }, 404);
      sharedPostId = shared.id;
    }
    const post = await prisma.universityPost.create({
      data: { authorId: auth.user.id, universityId: auth.user.universityId, content: content ?? "", attachments, visibility: visibility as "UNIVERSITY" | "CONNECTIONS" | "PRIVATE", status: "PENDING", requiresProctorApproval: true, sharedPostId },
      select: { id: true, status: true, createdAt: true },
    });
    return apiJson({ success: true, post, message: "Post submitted for moderation." }, 201);
  } catch {
    return apiJson({ success: false, message: "Post could not be created." }, 500);
  }
}
