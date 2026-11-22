import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const profile = await prisma.unifiedProfile.findUnique({ where: { userId: auth.user.id }, include: { mentorProfile: true } });
    return apiJson({ success: true, mentorProfile: profile?.mentorProfile ?? null });
  } catch {
    return apiJson({ success: false, message: "Mentor settings could not be loaded." }, 500);
  }
}

export async function PUT(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (!(["FACULTY", "ALUMNI", "STUDENT"] as string[]).includes(auth.user.primaryRole)) return apiJson({ success: false, message: "This account is not eligible for mentorship." }, 403);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["enabled", "bio", "expertise", "eligibleSemesters", "available"]);
    if (invalid) return invalid;
    const enabled = parsed.body.enabled;
    const available = parsed.body.available ?? true;
    const bio = parsed.body.bio;
    const expertise = parsed.body.expertise;
    const semesters = parsed.body.eligibleSemesters ?? [];
    if (typeof enabled !== "boolean" || typeof available !== "boolean" || typeof bio !== "string" || bio.trim().length > 2000) return apiJson({ success: false, message: "Provide valid mentor settings." }, 400);
    if (!Array.isArray(expertise) || expertise.length > 30 || expertise.some((value) => typeof value !== "string" || !value.trim() || value.trim().length > 80)) return apiJson({ success: false, message: "Expertise must be a list of up to 30 values." }, 400);
    if (!Array.isArray(semesters) || semesters.length > 12 || semesters.some((value) => !Number.isInteger(value) || value < 1 || value > 20)) return apiJson({ success: false, message: "Eligible semesters must be valid semester numbers." }, 400);
    if (enabled && auth.user.primaryRole === "STUDENT") {
      const verified = await prisma.profileSkillVerification.count({ where: { userId: auth.user.id, status: "VERIFIED", profile: { user: { universityId: auth.user.universityId } } } });
      if (!verified) return apiJson({ success: false, message: "Student mentors need at least one verified skill before opting in." }, 403);
    }
    const profile = await prisma.unifiedProfile.upsert({ where: { userId: auth.user.id }, create: { userId: auth.user.id }, update: {}, select: { id: true } });
    const mentorProfile = await prisma.mentorProfile.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, profileId: profile.id, enabled, available, bio: bio.trim(), expertise: [...new Set((expertise as string[]).map((value) => value.trim()))], eligibleSemesters: [...new Set(semesters as number[])] },
      update: { enabled, available, bio: bio.trim(), expertise: [...new Set((expertise as string[]).map((value) => value.trim()))], eligibleSemesters: [...new Set(semesters as number[])] },
    });
    return apiJson({ success: true, mentorProfile });
  } catch {
    return apiJson({ success: false, message: "Mentor settings could not be saved." }, 500);
  }
}
