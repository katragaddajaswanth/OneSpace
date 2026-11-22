import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, hasSecondaryRole } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const mayVerify = auth.user.primaryRole === "FACULTY" || hasSecondaryRole(auth.user, "MENTOR") || hasSecondaryRole(auth.user, "ADMINISTRATOR");
    if (!mayVerify) return apiJson({ success: false, message: "Faculty, mentors, or administrators may verify skills." }, 403);
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["decision"]);
    if (invalid) return invalid;
    const decision = parsed.body.decision;
    if (decision !== "VERIFY" && decision !== "REJECT") return apiJson({ success: false, message: "Decision must be VERIFY or REJECT." }, 400);
    const result = await prisma.profileSkillVerification.updateMany({
      where: { id, status: "PENDING", profile: { user: { universityId: auth.user.universityId } } },
      data: { status: decision === "VERIFY" ? "VERIFIED" : "REJECTED", verifierId: auth.user.id, verifiedAt: new Date() },
    });
    if (result.count !== 1) return apiJson({ success: false, message: "Pending skill verification not found." }, 404);
    return apiJson({ success: true, status: decision === "VERIFY" ? "VERIFIED" : "REJECTED" });
  } catch {
    return apiJson({ success: false, message: "Skill verification could not be completed." }, 500);
  }
}
