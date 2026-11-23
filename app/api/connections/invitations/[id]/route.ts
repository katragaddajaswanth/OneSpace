import { requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["decision"]);
    if (invalid) return invalid;
    const decision = parsed.body.decision;
    if (decision !== "ACCEPT" && decision !== "REJECT") return apiJson({ success: false, message: "Decision must be ACCEPT or REJECT." }, 400);
    const invitation = await prisma.$transaction(async (tx) => {
      const pending = await tx.connectionInvitation.findFirst({ where: { id, recipientId: auth.user.id, status: "PENDING", sender: { universityId: auth.user.universityId }, recipient: { universityId: auth.user.universityId } }, select: { id: true, senderId: true, recipientId: true } });
      if (!pending) return null;
      const updated = await tx.connectionInvitation.updateMany({
        where: { id, recipientId: auth.user.id, status: "PENDING", sender: { universityId: auth.user.universityId }, recipient: { universityId: auth.user.universityId } },
        data: { status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED", respondedAt: new Date() },
      });
      if (updated.count !== 1) return null;
      if (decision === "ACCEPT") {
        const [userAId, userBId] = [pending.senderId, pending.recipientId].sort();
        await tx.userConnection.upsert({ where: { userAId_userBId: { userAId, userBId } }, create: { userAId, userBId }, update: {} });
      }
      return { id: pending.id, status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED" };
    });
    if (!invitation) return apiJson({ success: false, message: "Invitation is unavailable or already reviewed." }, 404);
    return apiJson({ success: true, invitation });
  } catch {
    return apiJson({ success: false, message: "Invitation could not be updated." }, 500);
  }
}
