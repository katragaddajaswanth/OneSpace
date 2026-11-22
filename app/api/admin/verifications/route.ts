import { requireUniversityRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityRoles(["ADMINISTRATOR"] as const, "Administrator access is required.", request);
    if (auth.response) return auth.response;
    const universityId = auth.user.universityId;
    const [certifications, skills] = await Promise.all([
      prisma.profileCertification.findMany({ where: { status: "PENDING", profile: { user: { universityId } } }, orderBy: { createdAt: "asc" }, take: 50, select: { id: true, title: true, issuer: true, createdAt: true, owner: { select: { fullName: true, primaryRole: true } } } }),
      prisma.profileSkillVerification.findMany({ where: { status: "PENDING", profile: { user: { universityId } } }, orderBy: { createdAt: "asc" }, take: 50, select: { id: true, skill: true, createdAt: true, user: { select: { fullName: true, primaryRole: true } } } }),
    ]);
    return apiJson({ success: true, certifications, skills });
  } catch {
    return apiJson({ success: false, message: "Verification queues could not be loaded." }, 500);
  }
}
