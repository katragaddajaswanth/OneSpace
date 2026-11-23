import { requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText, hasSecondaryRole } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const permitted = auth.user.primaryRole === "FACULTY" || hasSecondaryRole(auth.user, "MENTOR") || hasSecondaryRole(auth.user, "ADMINISTRATOR");
    if (!permitted) return apiJson({ success: false, message: "Faculty, mentors, or administrators may verify certifications." }, 403);
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["decision"]);
    if (invalid) return invalid;
    const decision = parsed.body.decision;
    if (decision !== "VERIFY" && decision !== "REJECT") return apiJson({ success: false, message: "Decision must be VERIFY or REJECT." }, 400);
    const record = await prisma.profileCertification.findFirst({
      where: { id, status: "PENDING", profile: { user: { universityId: auth.user.universityId } } },
      select: { id: true },
    });
    if (!record) return apiJson({ success: false, message: "Pending certification not found." }, 404);
    const result = await prisma.profileCertification.updateMany({
      where: { id, status: "PENDING", profile: { user: { universityId: auth.user.universityId } } },
      data: { status: decision === "VERIFY" ? "VERIFIED" : "REJECTED", verifiedById: auth.user.id, verifiedAt: new Date() },
    });
    if (result.count !== 1) return apiJson({ success: false, message: "Certification was already reviewed." }, 409);
    return apiJson({ success: true, status: decision === "VERIFY" ? "VERIFIED" : "REJECTED" });
  } catch {
    return apiJson({ success: false, message: "Certification review failed." }, 500);
  }
}
