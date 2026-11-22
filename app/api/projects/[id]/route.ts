import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const project = await prisma.project.findFirst({
      where: { id, universityId: auth.user.universityId, OR: [{ status: { in: ["OPEN", "IN_PROGRESS", "COMPLETED"] } }, { leadId: auth.user.id }, { members: { some: { userId: auth.user.id } } }] },
      select: { id: true, title: true, description: true, category: true, theme: true, problemStatement: true, requiredSkills: true, objectives: true, outcomes: true, status: true, coverImageUrl: true, leadId: true, createdAt: true, lead: { select: { fullName: true } }, members: { select: { userId: true, user: { select: { fullName: true } } } }, evaluations: { orderBy: { createdAt: "desc" }, take: 5, select: { status: true, score: true, feedback: true, createdAt: true } } },
    });
    return project ? apiJson({ success: true, project }) : apiJson({ success: false, message: "Project not found." }, 404);
  } catch {
    return apiJson({ success: false, message: "Project could not be loaded." }, 500);
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
    const allowed = ["title", "description", "category", "theme", "problemStatement", "requiredSkills", "objectives", "outcomes", "visibility", "coverImageUrl"];
    const invalid = rejectUnexpectedFields(parsed.body, allowed);
    if (invalid) return invalid;
    const current = await prisma.project.findFirst({ where: { id, leadId: auth.user.id, universityId: auth.user.universityId, status: { in: ["DRAFT", "REJECTED"] } }, select: { id: true } });
    if (!current) return apiJson({ success: false, message: "Editable project draft not found." }, 404);
    const data: Record<string, unknown> = { status: "DRAFT", proctorId: null, proctorNote: null, proctorReviewedAt: null };
    for (const field of ["title", "description", "category", "theme", "problemStatement"] as const) {
      if (parsed.body[field] !== undefined) {
        const max = field === "description" ? 5000 : field === "problemStatement" ? 3000 : 160;
        const value = requiredText(parsed.body, field, max);
        if (!value) return apiJson({ success: false, errors: { [field]: "This field is required or too long." } }, 400);
        data[field] = value;
      }
    }
    for (const field of ["objectives", "outcomes"] as const) {
      if (parsed.body[field] !== undefined) {
        if (typeof parsed.body[field] !== "string" || parsed.body[field].trim().length > 3000) return apiJson({ success: false, errors: { [field]: "Must be 3000 characters or fewer." } }, 400);
        data[field] = parsed.body[field].trim();
      }
    }
    if (parsed.body.requiredSkills !== undefined) {
      if (!Array.isArray(parsed.body.requiredSkills) || parsed.body.requiredSkills.length > 30 || parsed.body.requiredSkills.some((value) => typeof value !== "string" || !value.trim() || value.trim().length > 80)) return apiJson({ success: false, message: "Invalid skills list." }, 400);
      data.requiredSkills = [...new Set((parsed.body.requiredSkills as string[]).map((value) => value.trim()))];
    }
    if (parsed.body.visibility !== undefined) {
      if (!["UNIVERSITY", "PRIVATE"].includes(String(parsed.body.visibility))) return apiJson({ success: false, message: "Unsupported project visibility." }, 400);
      data.visibility = parsed.body.visibility;
    }
    if (parsed.body.coverImageUrl !== undefined) {
      const url = parsed.body.coverImageUrl;
      if (url !== null && url !== "" && (typeof url !== "string" || !/^https?:\/\//i.test(url) || url.length > 2048)) return apiJson({ success: false, message: "Cover image must be an HTTP or HTTPS URL." }, 400);
      data.coverImageUrl = url || null;
    }
    const project = await prisma.project.update({ where: { id }, data, select: { id: true, title: true, status: true, updatedAt: true } });
    return apiJson({ success: true, project });
  } catch {
    return apiJson({ success: false, message: "Project could not be updated." }, 500);
  }
}
