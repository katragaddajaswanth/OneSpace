import { requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, hasSecondaryRole, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") return apiJson({ success: false, message: "Project evaluation is unavailable to prospective students." }, 403);
    if (!hasSecondaryRole(auth.user, "PROJECT_ANALYSIS_CREW")) return apiJson({ success: false, message: "Project Analysis Crew access is required." }, 403);
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["status", "feedback", "score"]);
    if (invalid) return invalid;
    const status = parsed.body.status;
    const feedback = requiredText(parsed.body, "feedback", 3000);
    if (!feedback || !["ACCEPTED", "NEEDS_CHANGES"].includes(String(status))) return apiJson({ success: false, message: "Provide a valid evaluation decision and feedback." }, 400);
    const score = parsed.body.score === undefined || parsed.body.score === null ? null : Number(parsed.body.score);
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) return apiJson({ success: false, message: "Score must be an integer from 0 to 100." }, 400);
    const project = await prisma.project.findFirst({ where: { id, universityId: auth.user.universityId, status: { in: ["OPEN", "IN_PROGRESS", "COMPLETED"] } }, select: { id: true } });
    if (!project) return apiJson({ success: false, message: "Project not found." }, 404);
    const evaluation = await prisma.$transaction(async (tx) => {
      const created = await tx.projectEvaluation.create({ data: { projectId: id, reviewerId: auth.user.id, status: status as "ACCEPTED" | "NEEDS_CHANGES", score, feedback } });
      const projectUpdate = await tx.project.updateMany({
        where: { id, universityId: auth.user.universityId, status: { in: ["OPEN", "IN_PROGRESS", "COMPLETED"] } },
        data: { status: status === "ACCEPTED" ? "COMPLETED" : "IN_PROGRESS" },
      });
      if (projectUpdate.count !== 1) throw new Error("Project tenant or status changed");
      return created;
    });
    return apiJson({ success: true, evaluation }, 201);
  } catch {
    return apiJson({ success: false, message: "Project evaluation could not be saved." }, 500);
  }
}
