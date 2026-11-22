import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, hasSecondaryRole, pageInfo, parsePage } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (!hasSecondaryRole(auth.user, "PROJECT_ANALYSIS_CREW")) return apiJson({ success: false, message: "Project Analysis Crew access is required." }, 403);
    const pagination = parsePage(request.url, 20, 50);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const where = { status: "PENDING" as const, project: { universityId: auth.user.universityId } };
    const [requests, total] = await Promise.all([
      prisma.projectRevaluationRequest.findMany({ where, orderBy: { createdAt: "asc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, reason: true, createdAt: true, projectId: true, project: { select: { title: true } }, requester: { select: { id: true, fullName: true } } } }),
      prisma.projectRevaluationRequest.count({ where }),
    ]);
    return apiJson({ success: true, requests, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch { return apiJson({ success: false, message: "Revaluation queue could not be loaded." }, 500); }
}
