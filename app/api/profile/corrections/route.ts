import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, parsePage, readJsonObject, requiredText, rejectUnexpectedFields, pageInfo } from "@/lib/prototype-api";
import { connection } from "next/server";

const correctableFields = new Set([
  "fullName", "institutionalId", "departmentId", "programId",
  "admissionYear", "currentSemester", "batch",
]);

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const pagination = parsePage(request.url);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const where = { userId: auth.user.id, profile: { user: { universityId: auth.user.universityId } } };
    const [corrections, total] = await Promise.all([
      prisma.profileCorrection.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
      prisma.profileCorrection.count({ where }),
    ]);
    return apiJson({ success: true, corrections, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Profile corrections could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const unexpected = rejectUnexpectedFields(parsed.body, ["field", "proposedValue"]);
    if (unexpected) return unexpected;
    const field = requiredText(parsed.body, "field", 80);
    const proposedValue = requiredText(parsed.body, "proposedValue", 1000);
    if (!field || !correctableFields.has(field) || !proposedValue) {
      return apiJson({ success: false, message: "Provide a supported field and a non-empty correction." }, 400);
    }
    const profile = await prisma.unifiedProfile.upsert({ where: { userId: auth.user.id }, create: { userId: auth.user.id }, update: {}, select: { id: true } });
    const correction = await prisma.profileCorrection.create({
      data: { profileId: profile.id, userId: auth.user.id, field, proposedValue },
    });
    return apiJson({ success: true, correction }, 201);
  } catch {
    return apiJson({ success: false, message: "Profile correction could not be submitted." }, 500);
  }
}
