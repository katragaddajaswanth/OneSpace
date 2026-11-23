import { requireUniversityUser, requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, hasSecondaryRole, pageInfo, parsePage, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

function canModerate(user: { primaryRole: string; secondaryRoles: Array<{ role: string }> }) {
  return user.secondaryRoles.some((item) => item.role === "ADMINISTRATOR" || item.role === "PROCTOR");
}

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (!canModerate(auth.user)) return apiJson({ success: false, message: "Proctor or administrator access is required." }, 403);
    const pagination = parsePage(request.url);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const params = new URL(request.url).searchParams;
    const status = params.get("status") ?? "PENDING";
    if (!(["PENDING", "APPROVED", "REJECTED", "REMOVED"] as string[]).includes(status)) return apiJson({ success: false, message: "Invalid moderation status." }, 400);
    const where = { universityId: auth.user.universityId, status: status as "PENDING" | "APPROVED" | "REJECTED" | "REMOVED" };
    const [posts, total] = await Promise.all([
      prisma.universityPost.findMany({ where, orderBy: { createdAt: "asc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, authorId: true, content: true, attachments: true, status: true, visibility: true, createdAt: true, author: { select: { fullName: true, email: true } }, _count: { select: { reports: { where: { status: "PENDING" } } } } } }),
      prisma.universityPost.count({ where }),
    ]);
    return apiJson({ success: true, posts, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Moderation queue could not be loaded." }, 500);
  }
}

export async function PATCH(request: Request) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    if (!canModerate(auth.user)) return apiJson({ success: false, message: "Proctor or administrator access is required." }, 403);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["postId", "decision", "reason"]);
    if (invalid) return invalid;
    const postId = requiredText(parsed.body, "postId", 100);
    const decision = parsed.body.decision;
    if (!postId || !["APPROVE", "REJECT", "REMOVE"].includes(String(decision))) return apiJson({ success: false, message: "Provide a valid post and moderation decision." }, 400);
    const reason = parsed.body.reason === undefined ? null : requiredText(parsed.body, "reason", 1000);
    if (parsed.body.reason !== undefined && !reason) return apiJson({ success: false, message: "Reason must be 1–1000 characters." }, 400);
    const current = await prisma.universityPost.findFirst({ where: { id: postId, universityId: auth.user.universityId, status: decision === "REMOVE" ? { not: "REMOVED" } : "PENDING" }, select: { id: true } });
    if (!current) return apiJson({ success: false, message: "Post not found in a reviewable state." }, 404);
    const result = await prisma.universityPost.updateMany({
      where: { id: postId, universityId: auth.user.universityId, status: decision === "REMOVE" ? { not: "REMOVED" } : "PENDING" },
      data: { status: decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "REMOVED", moderatorId: auth.user.id, moderationNote: reason, moderatedAt: new Date() },
    });
    if (result.count !== 1) return apiJson({ success: false, message: "Post was already reviewed." }, 409);
    return apiJson({ success: true, status: decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "REMOVED" });
  } catch {
    return apiJson({ success: false, message: "Post review could not be completed." }, 500);
  }
}
