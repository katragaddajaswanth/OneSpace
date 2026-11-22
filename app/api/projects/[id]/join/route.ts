import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") return apiJson({ success: false, message: "Project membership requests are unavailable to prospective students." }, 403);
    if (auth.user.primaryRole !== "STUDENT") return apiJson({ success: false, message: "Only students may request project membership." }, 403);
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["message"]);
    if (invalid) return invalid;
    const message = parsed.body.message === undefined ? "" : typeof parsed.body.message === "string" && parsed.body.message.trim().length <= 1000 ? parsed.body.message.trim() : null;
    if (message === null) return apiJson({ success: false, message: "Message must be 1000 characters or fewer." }, 400);
    const project = await prisma.project.findFirst({ where: { id, universityId: auth.user.universityId, status: "OPEN", leadId: { not: auth.user.id } }, select: { id: true } });
    if (!project) return apiJson({ success: false, message: "Project is unavailable." }, 404);
    if (await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: id, userId: auth.user.id } }, select: { id: true } })) return apiJson({ success: false, message: "You are already a project member." }, 409);
    const joinRequest = await prisma.projectJoinRequest.create({ data: { projectId: id, userId: auth.user.id, message }, select: { id: true, status: true, createdAt: true } });
    return apiJson({ success: true, joinRequest }, 201);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return apiJson({ success: false, message: "A join request already exists." }, 409);
    return apiJson({ success: false, message: "Join request could not be submitted." }, 500);
  }
}
