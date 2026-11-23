import { requireUniversityUser, requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") return apiJson({ success: false, message: "Project member management is unavailable to prospective students." }, 403);
    const { id } = await context.params;
    const project = await prisma.project.findFirst({ where: { id, leadId: auth.user.id, universityId: auth.user.universityId }, select: { id: true } });
    if (!project) return apiJson({ success: false, message: "Project not found." }, 404);
    const requests = await prisma.projectJoinRequest.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" }, select: { id: true, message: true, status: true, createdAt: true, user: { select: { id: true, fullName: true, primaryRole: true } } } });
    return apiJson({ success: true, requests });
  } catch {
    return apiJson({ success: false, message: "Project requests could not be loaded." }, 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["requestId", "decision"]);
    if (invalid) return invalid;
    const requestId = requiredText(parsed.body, "requestId", 100);
    const decision = parsed.body.decision;
    if (!requestId || !["ACCEPT", "REJECT"].includes(String(decision))) return apiJson({ success: false, message: "Provide a valid request and decision." }, 400);
    const project = await prisma.project.findFirst({ where: { id, leadId: auth.user.id, universityId: auth.user.universityId, status: "OPEN" }, select: { id: true } });
    if (!project) return apiJson({ success: false, message: "Project not found." }, 404);
    await prisma.$transaction(async (tx) => {
      const result = await tx.projectJoinRequest.updateMany({
        where: { id: requestId, projectId: id, status: "PENDING", project: { universityId: auth.user.universityId, leadId: auth.user.id } },
        data: { status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED", respondedAt: new Date() },
      });
      if (result.count !== 1) throw new Error("Join request already resolved");
      if (decision === "ACCEPT") {
        const joinRequest = await tx.projectJoinRequest.findUnique({ where: { id: requestId }, select: { userId: true } });
        if (!joinRequest) throw new Error("Join request disappeared");
        await tx.projectMember.create({ data: { projectId: id, userId: joinRequest.userId } });
      }
    });
    return apiJson({ success: true, status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED" });
  } catch {
    return apiJson({ success: false, message: "Join request could not be reviewed." }, 409);
  }
}
