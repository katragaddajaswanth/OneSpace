import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, pageInfo, parsePage } from "@/lib/prototype-api";
import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const url = new URL(request.url);
    const page = parsePage(request.url, 24, 50);
    if (!page) return apiJson({ success: false, message: "Invalid pagination." }, 400);

    const search = (url.searchParams.get("search") ?? "").trim();
    const role = url.searchParams.get("role");
    const departmentId = url.searchParams.get("departmentId");
    const programId = url.searchParams.get("programId");
    const skill = (url.searchParams.get("skill") ?? "").trim();

    const allowedRoles = ["STUDENT", "FACULTY", "ALUMNI", "INDUSTRY_REPRESENTATIVE"];
    if (search.length > 100 || role && !allowedRoles.includes(role) || [...url.searchParams.keys()].some((key) => !["search", "role", "departmentId", "programId", "skill", "page", "limit"].includes(key))) {
      return apiJson({ success: false, message: "Unsupported or invalid directory filters." }, 400);
    }

    const universityId = auth.user.universityId;
    const university = await prisma.university.findUnique({
      where: { id: universityId },
      select: { id: true, name: true, slug: true, emailDomain: true, website: true, isActive: true, createdAt: true },
    });
    if (!university) return apiJson({ success: false, message: "University not found." }, 404);

    const [departments, roleCounts, allMembers, studentCount, facultyCount, alumniCount] = await Promise.all([
      prisma.department.findMany({
        where: { universityId },
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, code: true,
          programs: { orderBy: { name: "asc" }, select: { id: true, name: true, code: true } },
          users: { select: { id: true, primaryRole: true } },
        },
      }),
      prisma.user.groupBy({ by: ["primaryRole"], where: { universityId, accountStatus: "ACTIVE", emailVerified: true }, _count: { _all: true } }),
      prisma.user.count({ where: { universityId, accountStatus: "ACTIVE", emailVerified: true } }),
      prisma.user.count({ where: { universityId, primaryRole: "STUDENT", accountStatus: "ACTIVE", emailVerified: true } }),
      prisma.user.count({ where: { universityId, primaryRole: "FACULTY", accountStatus: "ACTIVE", emailVerified: true } }),
      prisma.user.count({ where: { universityId, primaryRole: "ALUMNI", accountStatus: "ACTIVE", emailVerified: true } }),
    ]);

    const industryRepresentative = role === "INDUSTRY_REPRESENTATIVE";
    const primaryRoleFilter = role && !industryRepresentative ? role : undefined;
    const visibilityWhere: Prisma.UserWhereInput = {
      OR: [
        { unifiedProfile: { is: { visibility: { in: ["UNIVERSITY", "PUBLIC"] } } } },
        { id: auth.user.id },
      ],
    };
    const skillWhere: Prisma.UserWhereInput = skill ? {
      unifiedProfile: {
        is: {
          OR: [
            { skills: { has: skill } },
            { skillVerifications: { some: { skill: { contains: skill, mode: "insensitive" }, status: "VERIFIED" } } },
          ],
        },
      },
    } : {};
    const where: Prisma.UserWhereInput = {
      universityId,
      accountStatus: "ACTIVE",
      emailVerified: true,
      ...(primaryRoleFilter ? { primaryRole: primaryRoleFilter as "STUDENT" | "FACULTY" | "ALUMNI" | "PROSPECTIVE_STUDENT" } : {}),
      ...(industryRepresentative ? { secondaryRoles: { some: { role: "INDUSTRY_REPRESENTATIVE" } } } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(programId ? { programId } : {}),
      ...(search ? { OR: [{ fullName: { contains: search, mode: "insensitive" } }, { institutionalId: { contains: search, mode: "insensitive" } }] } : {}),
      AND: [visibilityWhere, skillWhere],
    };

    const [members, memberCount] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { fullName: "asc" },
        skip: page.skip,
        take: page.limit,
        select: {
          id: true, fullName: true, primaryRole: true, institutionalId: true,
          department: { select: { id: true, name: true } },
          program: { select: { id: true, name: true } },
          unifiedProfile: {
            select: {
              photoUrl: true, visibility: true, skills: true,
              certifications: { where: { status: "VERIFIED" }, select: { id: true } },
              skillVerifications: { where: { status: "VERIFIED" }, select: { skill: true } },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const departmentDirectory = departments.map((department) => {
      const faculty = department.users.filter((item) => item.primaryRole === "FACULTY").length;
      const students = department.users.filter((item) => item.primaryRole === "STUDENT").length;
      return { id: department.id, name: department.name, code: department.code, description: null, facultyCount: faculty, studentCount: students, programs: department.programs };
    });

    return apiJson({
      success: true,
      university,
      statistics: { allMembers, students: studentCount, faculty: facultyCount, alumni: alumniCount, departments: departments.length, programs: departments.reduce((total, item) => total + item.programs.length, 0), roleCounts: roleCounts.map((item) => ({ role: item.primaryRole, count: item._count._all })) },
      departments: departmentDirectory,
      members: members.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        primaryRole: member.primaryRole,
        institutionalId: member.institutionalId,
        department: member.department,
        program: member.program,
        photoUrl: member.unifiedProfile?.photoUrl ?? null,
        skills: member.unifiedProfile?.skills ?? [],
        verifiedSkills: member.unifiedProfile?.skillVerifications.map((item) => item.skill) ?? [],
        verifiedCertificationCount: member.unifiedProfile?.certifications.length ?? 0,
        profileVisibility: member.unifiedProfile?.visibility ?? "UNIVERSITY",
      })),
      pagination: pageInfo(page.page, page.limit, memberCount),
      basicInfoUnavailable: "A university description is not stored in the current schema.",
    });
  } catch {
    return apiJson({ success: false, message: "University data could not be loaded." }, 500);
  }
}
