import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { userId } = await context.params;
    const target = await prisma.user.findFirst({
      where: { id: userId, universityId: auth.user.universityId, accountStatus: "ACTIVE", emailVerified: true },
      select: {
        id: true, fullName: true, primaryRole: true,
        university: { select: { id: true, name: true } },
        department: { select: { name: true, code: true } },
        program: { select: { name: true, code: true } },
        unifiedProfile: {
          include: {
            experiences: { orderBy: { startedAt: "desc" } },
            certifications: { where: { status: "VERIFIED" }, orderBy: { issuedAt: "desc" } },
            achievements: { orderBy: { createdAt: "desc" } },
            mentorProfile: { where: { enabled: true, available: true } },
          },
        },
      },
    });
    if (!target) return apiJson({ success: false, message: "Profile not found." }, 404);
    const isOwner = target.id === auth.user.id;
    if (!isOwner && target.unifiedProfile?.visibility === "PRIVATE") return apiJson({ success: false, message: "Profile not found." }, 404);
    return apiJson({ success: true, profile: target });
  } catch {
    return apiJson({ success: false, message: "Profile could not be loaded." }, 500);
  }
}
