import { requireUniversityRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityRoles(["ADMINISTRATOR"] as const, "Administrator access is required.", request);
    if (auth.response) return auth.response;
    const communities = await prisma.community.findMany({ where: { universityId: auth.user.universityId, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100, select: { id: true, name: true, description: true, category: true, tags: true, privacy: true, createdAt: true, creator: { select: { id: true, fullName: true, email: true } } } });
    return apiJson({ success: true, communities });
  } catch {
    return apiJson({ success: false, message: "Community review queue could not be loaded." }, 500);
  }
}

export async function PATCH(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityRoles(["ADMINISTRATOR"] as const, "Administrator access is required.", request);
    if (auth.response) return auth.response;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["communityId", "decision", "note"]);
    if (invalid) return invalid;
    const communityId = requiredText(parsed.body, "communityId", 100);
    const decision = parsed.body.decision;
    if (!communityId || !["APPROVE", "REJECT"].includes(String(decision))) return apiJson({ success: false, message: "Provide a valid community decision." }, 400);
    const note = parsed.body.note === undefined ? null : requiredText(parsed.body, "note", 1500);
    if (parsed.body.note !== undefined && !note) return apiJson({ success: false, message: "Review note is invalid." }, 400);
    const result = await prisma.community.updateMany({ where: { id: communityId, universityId: auth.user.universityId, status: "PENDING" }, data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", reviewedById: auth.user.id, reviewNote: note, reviewedAt: new Date() } });
    if (!result.count) return apiJson({ success: false, message: "Pending community not found." }, 404);
    return apiJson({ success: true, status: decision === "APPROVE" ? "APPROVED" : "REJECTED" });
  } catch {
    return apiJson({ success: false, message: "Community review could not be completed." }, 500);
  }
}
