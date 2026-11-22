import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, parsePage, pageInfo } from "@/lib/prototype-api";
import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const pagination = parsePage(request.url);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const params = new URL(request.url).searchParams;
    const search = (params.get("search") ?? "").trim();
    const domain = params.get("domain");
    const where: Prisma.MentorProfileWhereInput = {
      enabled: true,
      available: true,
      user: { universityId: auth.user.universityId, accountStatus: "ACTIVE", emailVerified: true, unifiedProfile: { is: { visibility: { in: ["UNIVERSITY", "PUBLIC"] } } } },
      ...(domain ? { expertise: { has: domain } } : {}),
      ...(search ? { OR: [{ bio: { contains: search, mode: "insensitive" as const } }, { expertise: { has: search } }, { user: { fullName: { contains: search, mode: "insensitive" as const } } }] } : {}),
    };
    const [mentors, total] = await Promise.all([
      prisma.mentorProfile.findMany({ where, orderBy: { updatedAt: "desc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, bio: true, expertise: true, eligibleSemesters: true, user: { select: { id: true, fullName: true, primaryRole: true, department: { select: { name: true } }, unifiedProfile: { select: { photoUrl: true, certifications: { where: { status: "VERIFIED" }, select: { title: true, issuer: true } }, skillVerifications: { where: { status: "VERIFIED" }, select: { skill: true } } } } } } } }),
      prisma.mentorProfile.count({ where }),
    ]);
    return apiJson({ success: true, mentors, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Mentors could not be loaded." }, 500);
  }
}
