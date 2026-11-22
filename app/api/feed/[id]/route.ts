import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["content", "attachments", "visibility"]);
    if (invalid) return invalid;
    const current = await prisma.universityPost.findFirst({ where: { id, authorId: auth.user.id, universityId: auth.user.universityId, status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } });
    if (!current) return apiJson({ success: false, message: "Post not found." }, 404);
    const data: { content?: string; attachments?: string[]; visibility?: "UNIVERSITY" | "CONNECTIONS" | "PRIVATE"; status: "PENDING"; moderatorId: null; moderatedAt: null } = { status: "PENDING", moderatorId: null, moderatedAt: null };
    if (parsed.body.content !== undefined) {
      const content = requiredText(parsed.body, "content", 5000);
      if (!content) return apiJson({ success: false, message: "Post text must be 1–5000 characters." }, 400);
      data.content = content;
    }
    if (parsed.body.attachments !== undefined) {
      if (!Array.isArray(parsed.body.attachments) || parsed.body.attachments.length > 4 || parsed.body.attachments.some((item) => typeof item !== "string" || !/^https?:\/\//i.test(item))) return apiJson({ success: false, message: "Provide up to 4 HTTP or HTTPS attachment links." }, 400);
      data.attachments = parsed.body.attachments as string[];
    }
    if (parsed.body.visibility !== undefined) {
      if (!["UNIVERSITY", "CONNECTIONS", "PRIVATE"].includes(String(parsed.body.visibility))) return apiJson({ success: false, message: "Unsupported visibility." }, 400);
      data.visibility = parsed.body.visibility as "UNIVERSITY" | "CONNECTIONS" | "PRIVATE";
    }
    const post = await prisma.universityPost.update({ where: { id }, data, select: { id: true, status: true, updatedAt: true } });
    return apiJson({ success: true, post, message: "Edited post returned to moderation." });
  } catch {
    return apiJson({ success: false, message: "Post could not be updated." }, 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const result = await prisma.universityPost.updateMany({
      where: { id, authorId: auth.user.id, universityId: auth.user.universityId, status: { not: "REMOVED" } },
      data: { status: "REMOVED" },
    });
    if (result.count !== 1) return apiJson({ success: false, message: "Post not found." }, 404);
    return apiJson({ success: true, message: "Post removed." });
  } catch {
    return apiJson({ success: false, message: "Post could not be removed." }, 500);
  }
}
