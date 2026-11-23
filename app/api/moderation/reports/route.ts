import { requireUniversityUser, requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, pageInfo, parsePage, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

function isModerator(user: { secondaryRoles: Array<{ role: string }> }) {
  return user.secondaryRoles.some((item) => item.role === "ADMINISTRATOR" || item.role === "PROCTOR");
}

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (!isModerator(auth.user)) return apiJson({ success: false, message: "Proctor or administrator access is required." }, 403);
    const pagination = parsePage(request.url);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const where = { status: "PENDING" as const, post: { universityId: auth.user.universityId } };
    const [reports, total] = await Promise.all([
      prisma.postReport.findMany({ where, orderBy: { createdAt: "asc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, reason: true, createdAt: true, post: { select: { id: true, content: true, status: true } }, reporter: { select: { fullName: true } } } }),
      prisma.postReport.count({ where }),
    ]);
    return apiJson({ success: true, reports, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Reports could not be loaded." }, 500);
  }
}

export async function PATCH(request: Request) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    if (!isModerator(auth.user)) return apiJson({ success: false, message: "Proctor or administrator access is required." }, 403);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["reportId", "decision", "reviewNote"]);
    if (invalid) return invalid;
    const reportId = requiredText(parsed.body, "reportId", 100);
    const decision = parsed.body.decision;
    if (!reportId || !["REVIEWED", "DISMISSED"].includes(String(decision))) return apiJson({ success: false, message: "Provide a valid report decision." }, 400);
    const reviewNote = parsed.body.reviewNote === undefined ? null : requiredText(parsed.body, "reviewNote", 1000);
    if (parsed.body.reviewNote !== undefined && !reviewNote) return apiJson({ success: false, message: "Review note must be 1–1000 characters." }, 400);
    const result = await prisma.postReport.updateMany({
      where: { id: reportId, status: "PENDING", post: { universityId: auth.user.universityId } },
      data: { status: decision as "REVIEWED" | "DISMISSED", reviewNote, reviewedById: auth.user.id, reviewedAt: new Date() },
    });
    if (!result.count) return apiJson({ success: false, message: "Pending report not found." }, 404);
    return apiJson({ success: true, status: decision });
  } catch {
    return apiJson({ success: false, message: "Report review could not be completed." }, 500);
  }
}
