import { requireUniversityUser, requireWritableUniversityRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, hasSecondaryRole, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

function mayReview(user: { secondaryRoles: Array<{ role: string }> }) {
  return user.secondaryRoles.some((item) => item.role === "PROCTOR" || item.role === "ADMINISTRATOR");
}

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (!mayReview(auth.user)) return apiJson({ success: false, message: "Proctor or administrator access is required." }, 403);
    const projects = await prisma.project.findMany({ where: { universityId: auth.user.universityId, status: "PENDING_PROCTOR_APPROVAL" }, orderBy: { createdAt: "asc" }, take: 50, select: { id: true, title: true, description: true, category: true, theme: true, problemStatement: true, requiredSkills: true, createdAt: true, lead: { select: { id: true, fullName: true } } } });
    return apiJson({ success: true, projects });
  } catch {
    return apiJson({ success: false, message: "Project approval queue could not be loaded." }, 500);
  }
}

export async function PATCH(request: Request) {
  await connection();
  try {
    const auth = await requireWritableUniversityRoles(["PROCTOR", "ADMINISTRATOR"], "Proctor or administrator access is required.", request);
    if (auth.response) return auth.response;
    if (!mayReview(auth.user)) return apiJson({ success: false, message: "Proctor or administrator access is required." }, 403);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["projectId", "decision", "note"]);
    if (invalid) return invalid;
    const projectId = requiredText(parsed.body, "projectId", 100);
    const decision = parsed.body.decision;
    if (!projectId || !["APPROVE", "REJECT"].includes(String(decision))) return apiJson({ success: false, message: "Provide a valid project decision." }, 400);
    const note = parsed.body.note === undefined ? null : requiredText(parsed.body, "note", 1500);
    if (parsed.body.note !== undefined && !note) return apiJson({ success: false, message: "Review note must be 1–1500 characters." }, 400);
    const result = await prisma.project.updateMany({ where: { id: projectId, universityId: auth.user.universityId, status: "PENDING_PROCTOR_APPROVAL" }, data: { status: decision === "APPROVE" ? "OPEN" : "REJECTED", proctorId: auth.user.id, proctorNote: note, proctorReviewedAt: new Date() } });
    if (!result.count) return apiJson({ success: false, message: "Pending project not found." }, 404);
    return apiJson({ success: true, status: decision === "APPROVE" ? "OPEN" : "REJECTED" });
  } catch {
    return apiJson({ success: false, message: "Project review could not be completed." }, 500);
  }
}
