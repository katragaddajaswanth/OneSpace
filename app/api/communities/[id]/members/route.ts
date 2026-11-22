import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, hasSecondaryRole, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

async function canManage(communityId: string, userId: string, universityId: string, user: { secondaryRoles: Array<{ role: string }> }) {
  if (hasSecondaryRole(user as never, "ADMINISTRATOR")) return true;
  return Boolean(await prisma.community.findFirst({ where: { id: communityId, universityId, createdById: userId }, select: { id: true } }));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const allowed = await canManage(id, auth.user.id, auth.user.universityId, auth.user);
    const isMember = await prisma.communityMembership.findFirst({ where: { communityId: id, userId: auth.user.id, status: "APPROVED", community: { universityId: auth.user.universityId } }, select: { id: true } });
    if (!allowed && !isMember) return apiJson({ success: false, message: "Community membership required." }, 403);
    const members = await prisma.communityMembership.findMany({ where: { communityId: id, status: "APPROVED", community: { universityId: auth.user.universityId } }, orderBy: { requestedAt: "asc" }, take: 200, select: { id: true, requestedAt: true, user: { select: { id: true, fullName: true, primaryRole: true } } } });
    return apiJson({ success: true, members });
  } catch {
    return apiJson({ success: false, message: "Community members could not be loaded." }, 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    if (!(await canManage(id, auth.user.id, auth.user.universityId, auth.user))) return apiJson({ success: false, message: "Community creator or administrator access is required." }, 403);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["membershipId", "decision"]);
    if (invalid) return invalid;
    const membershipId = requiredText(parsed.body, "membershipId", 100);
    const decision = parsed.body.decision;
    if (!membershipId || !["APPROVE", "REJECT"].includes(String(decision))) return apiJson({ success: false, message: "Provide a valid membership decision." }, 400);
    const result = await prisma.communityMembership.updateMany({ where: { id: membershipId, communityId: id, status: "PENDING", community: { universityId: auth.user.universityId } }, data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", respondedAt: new Date() } });
    if (!result.count) return apiJson({ success: false, message: "Pending membership request not found." }, 404);
    return apiJson({ success: true, status: decision === "APPROVE" ? "APPROVED" : "REJECTED" });
  } catch {
    return apiJson({ success: false, message: "Membership request could not be reviewed." }, 500);
  }
}
