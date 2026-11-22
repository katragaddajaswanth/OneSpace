import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const records = await prisma.profileCertification.findMany({
      where: { ownerId: auth.user.id, profile: { user: { universityId: auth.user.universityId } } },
      orderBy: { createdAt: "desc" },
    });
    return apiJson({ success: true, certifications: records });
  } catch {
    return apiJson({ success: false, message: "Certifications could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["title", "issuer", "credentialUrl", "issuedAt"]);
    if (invalid) return invalid;
    const title = requiredText(parsed.body, "title", 200);
    const issuer = requiredText(parsed.body, "issuer", 200);
    if (!title || !issuer) return apiJson({ success: false, message: "Title and issuer are required." }, 400);
    const credentialUrl = parsed.body.credentialUrl === undefined || parsed.body.credentialUrl === null || parsed.body.credentialUrl === ""
      ? null
      : typeof parsed.body.credentialUrl === "string" && parsed.body.credentialUrl.length <= 2048 && /^https?:\/\//i.test(parsed.body.credentialUrl)
        ? parsed.body.credentialUrl
        : undefined;
    if (credentialUrl === undefined) return apiJson({ success: false, message: "Credential URL must be HTTP or HTTPS." }, 400);
    const issuedAt = parsed.body.issuedAt ? new Date(String(parsed.body.issuedAt)) : null;
    if (issuedAt && Number.isNaN(issuedAt.getTime())) return apiJson({ success: false, message: "Enter a valid issue date." }, 400);
    const profile = await prisma.unifiedProfile.upsert({ where: { userId: auth.user.id }, create: { userId: auth.user.id }, update: {}, select: { id: true } });
    const certification = await prisma.profileCertification.create({
      data: { profileId: profile.id, ownerId: auth.user.id, title, issuer, credentialUrl, issuedAt },
    });
    return apiJson({ success: true, certification }, 201);
  } catch {
    return apiJson({ success: false, message: "Certification could not be submitted." }, 500);
  }
}
