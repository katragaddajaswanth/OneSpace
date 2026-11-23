import { requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") return apiJson({ success: false, message: "Project submission is unavailable to prospective students." }, 403);
    const { id } = await context.params;
    const result = await prisma.project.updateMany({
      where: { id, leadId: auth.user.id, universityId: auth.user.universityId, status: { in: ["DRAFT", "REJECTED"] } },
      data: { status: "PENDING_PROCTOR_APPROVAL", proctorId: null, proctorNote: null, proctorReviewedAt: null },
    });
    if (result.count !== 1) return apiJson({ success: false, message: "Editable draft not found." }, 404);
    return apiJson({ success: true, status: "PENDING_PROCTOR_APPROVAL" });
  } catch {
    return apiJson({ success: false, message: "Project could not be submitted." }, 500);
  }
}
