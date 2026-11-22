import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["decision"]);
    if (invalid) return invalid;
    const decision = parsed.body.decision;
    if (decision !== "ACCEPT" && decision !== "REJECT") return apiJson({ success: false, message: "Decision must be ACCEPT or REJECT." }, 400);
    const requestRecord = await prisma.mentorshipRequest.findFirst({ where: { id, status: "PENDING", mentor: { userId: auth.user.id, user: { universityId: auth.user.universityId } } }, select: { id: true, mentorId: true, menteeId: true } });
    if (!requestRecord) return apiJson({ success: false, message: "Pending mentorship request not found." }, 404);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.mentorshipRequest.updateMany({ where: { id, status: "PENDING", mentor: { userId: auth.user.id } }, data: { status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED", respondedAt: new Date() } });
      if (updated.count !== 1) throw new Error("Request already reviewed");
      if (decision === "ACCEPT") await tx.mentorshipRelationship.create({ data: { mentorId: requestRecord.mentorId, menteeId: requestRecord.menteeId, requestId: id } });
    });
    return apiJson({ success: true, status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED" });
  } catch {
    return apiJson({ success: false, message: "Mentorship request could not be reviewed." }, 409);
  }
}
