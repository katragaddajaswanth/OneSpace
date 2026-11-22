import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const body = parsed.body;
    const invalid = rejectUnexpectedFields(body, ["organization", "title", "description", "startedAt", "endedAt"]);
    if (invalid) return invalid;
    const organization = requiredText(body, "organization", 200);
    const title = requiredText(body, "title", 200);
    if (!organization || !title) return apiJson({ success: false, message: "Organization and title are required." }, 400);
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > 3000) return apiJson({ success: false, message: "Description must be 3000 characters or fewer." }, 400);
    function dateField(field: string): Date | null | undefined {
      const value = body[field];
      if (value === undefined || value === null || value === "") return null;
      if (typeof value !== "string") return undefined;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }
    const startedAt = dateField("startedAt");
    const endedAt = dateField("endedAt");
    if (startedAt === undefined || endedAt === undefined) return apiJson({ success: false, message: "Enter valid experience dates." }, 400);
    const profile = await prisma.unifiedProfile.upsert({ where: { userId: auth.user.id }, create: { userId: auth.user.id }, update: {}, select: { id: true } });
    const experience = await prisma.profileExperience.create({ data: { profileId: profile.id, organization, title, description, startedAt, endedAt } });
    return apiJson({ success: true, experience }, 201);
  } catch {
    return apiJson({ success: false, message: "Experience could not be saved." }, 500);
  }
}
