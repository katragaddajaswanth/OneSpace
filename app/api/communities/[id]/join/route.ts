import { requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") return apiJson({ success: false, message: "Joining university communities is unavailable to prospective students." }, 403);
    const { id } = await context.params;
    const community = await prisma.community.findFirst({ where: { id, universityId: auth.user.universityId, status: "APPROVED" }, select: { id: true, privacy: true } });
    if (!community) return apiJson({ success: false, message: "Community not found." }, 404);
    const status = community.privacy === "OPEN" ? "APPROVED" : "PENDING";
    const membership = await prisma.communityMembership.upsert({
      where: { communityId_userId: { communityId: id, userId: auth.user.id } },
      create: { communityId: id, userId: auth.user.id, status },
      update: { status, requestedAt: new Date(), respondedAt: status === "APPROVED" ? new Date() : null },
      select: { id: true, status: true, requestedAt: true },
    });
    return apiJson({ success: true, membership }, status === "APPROVED" ? 200 : 202);
  } catch {
    return apiJson({ success: false, message: "Community membership request failed." }, 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const result = await prisma.communityMembership.updateMany({
      where: { communityId: id, userId: auth.user.id, community: { universityId: auth.user.universityId }, status: { in: ["APPROVED", "PENDING"] } },
      data: { status: "REJECTED", respondedAt: new Date() },
    });
    if (!result.count) return apiJson({ success: false, message: "Membership not found." }, 404);
    return apiJson({ success: true, message: "You have left the community." });
  } catch {
    return apiJson({ success: false, message: "Could not leave the community." }, 500);
  }
}
