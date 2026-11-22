import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText, hasSecondaryRole } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const community = await prisma.community.findFirst({
      where: { id, universityId: auth.user.universityId, OR: [{ status: "APPROVED" }, { createdById: auth.user.id }, { memberships: { some: { userId: auth.user.id, status: "APPROVED" } } }] },
      select: { id: true, name: true, description: true, category: true, tags: true, privacy: true, status: true, createdById: true, createdAt: true, creator: { select: { id: true, fullName: true } }, _count: { select: { memberships: { where: { status: "APPROVED" } }, posts: { where: { deletedAt: null } } } }, memberships: { where: { userId: auth.user.id }, select: { status: true }, take: 1 } },
    });
    return community ? apiJson({ success: true, community: { ...community, myMembershipStatus: community.memberships[0]?.status ?? null, memberships: undefined } }) : apiJson({ success: false, message: "Community not found." }, 404);
  } catch {
    return apiJson({ success: false, message: "Community could not be loaded." }, 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["name", "description", "category", "tags", "privacy"]);
    if (invalid) return invalid;
    const current = await prisma.community.findFirst({ where: { id, universityId: auth.user.universityId, createdById: auth.user.id, status: { in: ["PENDING", "REJECTED"] } }, select: { id: true } });
    if (!current) return apiJson({ success: false, message: "Editable community submission not found." }, 404);
    const data: Record<string, unknown> = { status: "PENDING", reviewedById: null, reviewedAt: null, reviewNote: null };
    for (const field of ["name", "description", "category"] as const) {
      if (parsed.body[field] !== undefined) {
        const max = field === "description" ? 3000 : field === "name" ? 100 : 80;
        const value = requiredText(parsed.body, field, max);
        if (!value) return apiJson({ success: false, errors: { [field]: "This field is required or too long." } }, 400);
        data[field] = value;
      }
    }
    if (parsed.body.tags !== undefined) {
      if (!Array.isArray(parsed.body.tags) || parsed.body.tags.length > 30 || parsed.body.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 60)) return apiJson({ success: false, message: "Invalid tags." }, 400);
      data.tags = [...new Set((parsed.body.tags as string[]).map((tag) => tag.trim()))];
    }
    if (parsed.body.privacy !== undefined) {
      if (!["OPEN", "APPROVAL_REQUIRED"].includes(String(parsed.body.privacy))) return apiJson({ success: false, message: "Invalid privacy setting." }, 400);
      data.privacy = parsed.body.privacy;
    }
    const community = await prisma.community.update({ where: { id }, data, select: { id: true, name: true, status: true } });
    return apiJson({ success: true, community });
  } catch {
    return apiJson({ success: false, message: "Community could not be updated." }, 500);
  }
}
