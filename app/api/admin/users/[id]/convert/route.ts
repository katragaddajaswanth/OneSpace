import { requireWritableUniversityRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversityRoles(["ADMINISTRATOR"], "Administrator access is required.", request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["institutionalId", "departmentId", "programId", "admissionYear", "batch"]);
    if (invalid) return invalid;

    const institutionalId = requiredText(parsed.body, "institutionalId", 100);
    const admissionYear = parsed.body.admissionYear === undefined ? null : Number(parsed.body.admissionYear);
    const batch = parsed.body.batch === undefined ? null : requiredText(parsed.body, "batch", 50);
    if (!institutionalId) return apiJson({ success: false, message: "An institutional ID is required for verified student conversion." }, 400);
    if (admissionYear !== null && (!Number.isInteger(admissionYear) || admissionYear < 1900 || admissionYear > 2100)) {
      return apiJson({ success: false, message: "Enter a valid admission year." }, 400);
    }
    if (parsed.body.batch !== undefined && !batch) return apiJson({ success: false, message: "Enter a valid batch." }, 400);

    const departmentId = parsed.body.departmentId === undefined ? null : parsed.body.departmentId;
    const programId = parsed.body.programId === undefined ? null : parsed.body.programId;
    if (departmentId !== null && typeof departmentId !== "string") return apiJson({ success: false, message: "Invalid department." }, 400);
    if (programId !== null && typeof programId !== "string") return apiJson({ success: false, message: "Invalid program." }, 400);

    const target = await prisma.user.findFirst({
      where: { id, universityId: auth.user.universityId, primaryRole: "PROSPECTIVE_STUDENT", accountStatus: "ACTIVE", emailVerified: true },
      select: { id: true, institutionalId: true, departmentId: true, programId: true },
    });
    if (!target) return apiJson({ success: false, message: "Active prospective student not found." }, 404);

    const duplicateInstitutionalId = await prisma.user.findFirst({
      where: { universityId: auth.user.universityId, institutionalId, id: { not: id } },
      select: { id: true },
    });
    if (duplicateInstitutionalId) return apiJson({ success: false, message: "This institutional ID is already assigned." }, 409);

    if (departmentId) {
      const department = await prisma.department.findFirst({ where: { id: departmentId, universityId: auth.user.universityId }, select: { id: true } });
      if (!department) return apiJson({ success: false, message: "Department does not belong to this university." }, 400);
    }
    if (programId) {
      const program = await prisma.program.findFirst({ where: { id: programId, department: { universityId: auth.user.universityId }, ...(departmentId ? { departmentId } : {}) }, select: { id: true } });
      if (!program) return apiJson({ success: false, message: "Program does not belong to this university department." }, 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          primaryRole: "STUDENT",
          institutionalId,
          ...(departmentId ? { departmentId } : {}),
          ...(programId ? { programId } : {}),
        },
      });
      await tx.studentProfile.upsert({
        where: { userId: id },
        update: { admissionYear: admissionYear ?? undefined, batch: batch ?? undefined },
        create: { userId: id, admissionYear: admissionYear ?? null, batch: batch ?? null },
      });
      await tx.authAuditLog.create({
        data: {
          userId: id,
          event: "PROSPECTIVE_CONVERTED",
          details: {
            action: "PROSPECTIVE_STUDENT_CONVERTED",
            actorId: auth.user.id,
            institutionalId,
          },
        },
      });
    });

    return apiJson({ success: true, message: "Prospective student was verified and converted to Student.", primaryRole: "STUDENT" });
  } catch {
    return apiJson({ success: false, message: "Prospective student conversion could not be completed." }, 500);
  }
}
