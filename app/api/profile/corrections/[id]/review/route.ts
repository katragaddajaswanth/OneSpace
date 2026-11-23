import { requireWritableUniversityRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversityRoles(["ADMINISTRATOR"] as const, "Administrator access is required.", request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const unexpected = rejectUnexpectedFields(parsed.body, ["decision", "reason"]);
    if (unexpected) return unexpected;
    const decision = parsed.body.decision;
    if (decision !== "APPROVE" && decision !== "REJECT") return apiJson({ success: false, message: "Decision must be APPROVE or REJECT." }, 400);
    const reason = parsed.body.reason === undefined ? null : requiredText(parsed.body, "reason", 1000);
    if (parsed.body.reason !== undefined && !reason) return apiJson({ success: false, message: "Reason must be 1–1000 characters." }, 400);

    const correction = await prisma.profileCorrection.findFirst({
      where: { id, status: "PENDING", profile: { user: { universityId: auth.user.universityId } } },
      include: { user: { select: { id: true, primaryRole: true } } },
    });
    if (!correction) return apiJson({ success: false, message: "Pending correction not found." }, 404);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.profileCorrection.updateMany({
        where: { id, status: "PENDING", profile: { user: { universityId: auth.user.universityId } } },
        data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", reason, reviewedById: auth.user.id, reviewedAt: new Date() },
      });
      if (updated.count !== 1) throw new Error("Correction already reviewed");
      if (decision !== "APPROVE") return;

      const value = correction.proposedValue;
      if (correction.field === "fullName") {
        await tx.user.update({ where: { id: correction.userId, universityId: auth.user.universityId }, data: { fullName: value } });
      } else if (correction.field === "institutionalId") {
        await tx.user.update({ where: { id: correction.userId, universityId: auth.user.universityId }, data: { institutionalId: value } });
      } else if (correction.field === "departmentId" || correction.field === "programId") {
        // Relational academic corrections are recorded for manual review only;
        // they are not applied without an ERP-backed verification source.
      } else if (correction.user.primaryRole === "STUDENT") {
        const intValue = Number(value);
        if (!Number.isInteger(intValue) || intValue < 0 || intValue > 20) throw new Error("Invalid academic correction");
        const profileData = correction.field === "admissionYear"
          ? { admissionYear: intValue }
          : correction.field === "currentSemester"
            ? { currentSemester: intValue }
            : { batch: value };
        await tx.studentProfile.upsert({ where: { userId: correction.userId }, create: { userId: correction.userId, ...profileData }, update: profileData });
      }
    });
    return apiJson({ success: true, decision: decision === "APPROVE" ? "APPROVED" : "REJECTED" });
  } catch {
    return apiJson({ success: false, message: "Correction review could not be completed." }, 500);
  }
}
