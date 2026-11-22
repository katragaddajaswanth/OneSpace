import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, hasSecondaryRole, pageInfo, parsePage } from "@/lib/prototype-api";
import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (!hasSecondaryRole(auth.user, "PROJECT_ANALYSIS_CREW")) return apiJson({ success: false, message: "Project Analysis Crew access is required." }, 403);
    const pagination = parsePage(request.url, 20, 50);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const where: Prisma.ProjectWhereInput = { universityId: auth.user.universityId, status: { in: ["OPEN", "IN_PROGRESS"] } };
    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where, orderBy: { updatedAt: "asc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, title: true, description: true, theme: true, problemStatement: true, status: true, updatedAt: true, lead: { select: { id: true, fullName: true } }, submissions: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, description: true, url: true, createdAt: true, submittedBy: { select: { fullName: true } } } }, evaluations: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, score: true, feedback: true, createdAt: true } } } }),
      prisma.project.count({ where }),
    ]);
    return apiJson({ success: true, projects, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch { return apiJson({ success: false, message: "Project evaluation queue could not be loaded." }, 500); }
}
