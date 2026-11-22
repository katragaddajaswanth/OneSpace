import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields } from "@/lib/prototype-api";
import { connection } from "next/server";

const editableFields = ["bio", "photoUrl", "coverUrl", "skills", "interests", "portfolioUrl", "linkedinUrl", "githubUrl", "visibility", "departmentId", "programId"];

function validUrl(value: unknown): value is string | null {
  if (value === null || value === "") return true;
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 50 && value.every(
    (item) => typeof item === "string" && item.trim().length > 0 && item.trim().length <= 80
  );
}

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const profile = await prisma.unifiedProfile.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id },
      update: {},
      include: {
        experiences: { orderBy: { startedAt: "desc" } },
        certifications: { orderBy: { createdAt: "desc" } },
        achievements: { orderBy: { createdAt: "desc" } },
      },
    });
    return apiJson({
      success: true,
      profile: {
        ...profile,
        identity: {
          fullName: auth.user.fullName,
          institutionalId: auth.user.institutionalId,
          primaryRole: auth.user.primaryRole,
          university: auth.user.university,
          department: auth.user.department,
          program: auth.user.program,
          studentProfile: auth.user.studentProfile,
          facultyProfile: auth.user.facultyProfile,
        },
      },
    });
  } catch {
    return apiJson({ success: false, message: "Profile could not be loaded." }, 500);
  }
}

export async function PATCH(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, editableFields);
    if (invalid) return invalid;

    const data: Record<string, unknown> = {};
    if (parsed.body.bio !== undefined) {
      if (typeof parsed.body.bio !== "string" || parsed.body.bio.trim().length > 3000) {
        return apiJson({ success: false, errors: { bio: "Bio must be 3000 characters or fewer." } }, 400);
      }
      data.bio = parsed.body.bio.trim();
    }
    for (const field of ["photoUrl", "coverUrl", "portfolioUrl", "linkedinUrl", "githubUrl"] as const) {
      if (parsed.body[field] !== undefined) {
        if (!validUrl(parsed.body[field])) return apiJson({ success: false, errors: { [field]: "Enter an HTTP or HTTPS URL." } }, 400);
        data[field] = parsed.body[field] || null;
      }
    }
    for (const field of ["skills", "interests"] as const) {
      if (parsed.body[field] !== undefined) {
        if (!validStringList(parsed.body[field])) return apiJson({ success: false, errors: { [field]: "Provide up to 50 text values, each 80 characters or fewer." } }, 400);
        data[field] = [...new Set((parsed.body[field] as string[]).map((item) => item.trim()))];
      }
    }
    if (parsed.body.visibility !== undefined) {
      if (!["PRIVATE", "UNIVERSITY", "PUBLIC"].includes(String(parsed.body.visibility))) {
        return apiJson({ success: false, errors: { visibility: "Select a supported visibility." } }, 400);
      }
      data.visibility = parsed.body.visibility;
    }

    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") {
      if (parsed.body.departmentId !== undefined) {
        if (parsed.body.departmentId === null || parsed.body.departmentId === "") {
          await prisma.user.update({ where: { id: auth.user.id }, data: { departmentId: null, programId: null } });
        } else if (typeof parsed.body.departmentId === "string") {
          const department = await prisma.department.findFirst({ where: { id: parsed.body.departmentId, universityId: auth.user.universityId }, select: { id: true } });
          if (!department) return apiJson({ success: false, message: "Select a department from your university." }, 400);
          await prisma.user.update({ where: { id: auth.user.id }, data: { departmentId: department.id, programId: parsed.body.programId ? undefined : null } });
        } else {
          return apiJson({ success: false, message: "Invalid intended department." }, 400);
        }
      }
      if (parsed.body.programId !== undefined) {
        if (parsed.body.programId === null || parsed.body.programId === "") {
          await prisma.user.update({ where: { id: auth.user.id }, data: { programId: null } });
        } else if (typeof parsed.body.programId === "string") {
          const departmentId = parsed.body.departmentId ?? auth.user.department?.id;
          const program = await prisma.program.findFirst({ where: { id: parsed.body.programId, departmentId: departmentId ?? undefined, department: { universityId: auth.user.universityId } }, select: { id: true } });
          if (!program) return apiJson({ success: false, message: "Select a program belonging to the intended department." }, 400);
          await prisma.user.update({ where: { id: auth.user.id }, data: { programId: program.id } });
        } else {
          return apiJson({ success: false, message: "Invalid intended program." }, 400);
        }
      }
    } else if (parsed.body.departmentId !== undefined || parsed.body.programId !== undefined) {
      return apiJson({ success: false, message: "Only prospective students may edit intended academic choices through this field." }, 403);
    }

    const profile = await prisma.unifiedProfile.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, ...data },
      update: data,
      select: {
        id: true, bio: true, photoUrl: true, coverUrl: true, skills: true, interests: true,
        portfolioUrl: true, linkedinUrl: true, githubUrl: true, visibility: true, updatedAt: true,
      },
    });
    return apiJson({ success: true, profile });
  } catch {
    return apiJson({ success: false, message: "Profile could not be updated." }, 500);
  }
}
