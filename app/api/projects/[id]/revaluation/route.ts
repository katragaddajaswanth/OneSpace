import { requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, hasSecondaryRole, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const project = await prisma.project.findFirst({ where: { id, leadId: auth.user.id, universityId: auth.user.universityId }, select: { id: true } });
    if (!project) return apiJson({ success: false, message: "Project not found." }, 404);
    const latest = await prisma.projectRevaluationRequest.findFirst({ where: { projectId: id, requesterId: auth.user.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (latest && Date.now() - latest.createdAt.getTime() < 10 * 24 * 60 * 60 * 1000) return apiJson({ success: false, message: "A 10-day cooling period applies between revaluation requests." }, 409);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["reason"]);
    if (invalid) return invalid;
    const reason = requiredText(parsed.body, "reason", 2000);
    if (!reason) return apiJson({ success: false, message: "Provide a revaluation reason." }, 400);
    const revaluation = await prisma.projectRevaluationRequest.create({ data: { projectId: id, requesterId: auth.user.id, reason }, select: { id: true, status: true, createdAt: true } });
    return apiJson({ success: true, revaluation }, 201);
  } catch {
    return apiJson({ success: false, message: "Revaluation request could not be submitted." }, 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    if (!hasSecondaryRole(auth.user, "PROJECT_ANALYSIS_CREW")) return apiJson({ success: false, message: "Project Analysis Crew access is required." }, 403);
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["requestId", "decision", "reviewNote"]);
    if (invalid) return invalid;
    const requestId = requiredText(parsed.body, "requestId", 100);
    const decision = parsed.body.decision;
    if (!requestId || !["ACCEPT", "REJECT"].includes(String(decision))) return apiJson({ success: false, message: "Provide a valid revaluation decision." }, 400);
    const reviewNote = parsed.body.reviewNote === undefined ? null : requiredText(parsed.body, "reviewNote", 2000);
    if (parsed.body.reviewNote !== undefined && !reviewNote) return apiJson({ success: false, message: "Review note is invalid." }, 400);
    const result = await prisma.projectRevaluationRequest.updateMany({ where: { id: requestId, projectId: id, status: "PENDING", project: { universityId: auth.user.universityId } }, data: { status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED", reviewerId: auth.user.id, reviewNote, reviewedAt: new Date() } });
    if (!result.count) return apiJson({ success: false, message: "Pending revaluation not found." }, 404);
    return apiJson({ success: true, status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED" });
  } catch {
    return apiJson({ success: false, message: "Revaluation review could not be completed." }, 500);
  }
}
