import { requireUniversityUser, requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const verifications = await prisma.profileSkillVerification.findMany({
      where: { userId: auth.user.id, profile: { user: { universityId: auth.user.universityId } } },
      orderBy: { createdAt: "desc" },
    });
    return apiJson({ success: true, verifications });
  } catch {
    return apiJson({ success: false, message: "Skill verification requests could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["skill"]);
    if (invalid) return invalid;
    const skill = requiredText(parsed.body, "skill", 80);
    if (!skill) return apiJson({ success: false, message: "Skill is required." }, 400);
    const profile = await prisma.unifiedProfile.upsert({ where: { userId: auth.user.id }, create: { userId: auth.user.id }, update: {}, select: { id: true } });
    const verification = await prisma.profileSkillVerification.upsert({
      where: { userId_skill: { userId: auth.user.id, skill } },
      create: { profileId: profile.id, userId: auth.user.id, skill },
      update: { status: "PENDING", verifierId: null, verifiedAt: null },
    });
    return apiJson({ success: true, verification }, 201);
  } catch {
    return apiJson({ success: false, message: "Skill verification request could not be saved." }, 500);
  }
}
