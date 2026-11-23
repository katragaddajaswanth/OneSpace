import { requireWritableUniversityRoles, requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const announcements = await prisma.universityPost.findMany({
      where: {
        universityId: auth.user.universityId,
        status: "APPROVED",
        author: { secondaryRoles: { some: { role: { in: ["ADMINISTRATOR", "PROCTOR"] } } } },
      },
      orderBy: { moderatedAt: "desc" },
      take: 50,
      select: {
        id: true, content: true, attachments: true, moderatedAt: true, createdAt: true,
        author: { select: { id: true, fullName: true, primaryRole: true } },
      },
    });
    return apiJson({ success: true, announcements });
  } catch {
    return apiJson({ success: false, message: "University announcements could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireWritableUniversityRoles(["ADMINISTRATOR", "PROCTOR"], "Administrator or Proctor authorization is required.", request);
    if (auth.response) return auth.response;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["content", "attachments"]);
    if (invalid) return invalid;
    const content = requiredText(parsed.body, "content", 5000);
    if (!content) return apiJson({ success: false, message: "Announcement text is required and must be 5000 characters or fewer." }, 400);
    const attachments = parsed.body.attachments ?? [];
    if (!Array.isArray(attachments) || attachments.length > 4 || attachments.some((item) => typeof item !== "string" || !/^https?:\/\//i.test(item))) {
      return apiJson({ success: false, message: "Provide up to 4 HTTP or HTTPS attachment links." }, 400);
    }
    const announcement = await prisma.universityPost.create({
      data: {
        authorId: auth.user.id,
        universityId: auth.user.universityId,
        content,
        attachments,
        visibility: "UNIVERSITY",
        status: "PENDING",
        requiresProctorApproval: true,
      },
      select: { id: true, status: true, createdAt: true },
    });
    return apiJson({ success: true, announcement, message: "Official announcement submitted for moderation." }, 201);
  } catch {
    return apiJson({ success: false, message: "Official announcement could not be submitted." }, 500);
  }
}
