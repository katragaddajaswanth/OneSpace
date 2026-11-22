import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["reason"]);
    if (invalid) return invalid;
    const reason = requiredText(parsed.body, "reason", 1000);
    if (!reason) return apiJson({ success: false, message: "Provide a report reason." }, 400);
    const post = await prisma.universityPost.findFirst({ where: { id, universityId: auth.user.universityId, status: "APPROVED" }, select: { id: true } });
    if (!post) return apiJson({ success: false, message: "Post not found." }, 404);
    const report = await prisma.postReport.create({ data: { postId: id, reporterId: auth.user.id, reason }, select: { id: true, status: true, createdAt: true } });
    return apiJson({ success: true, report }, 201);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return apiJson({ success: false, message: "You already reported this post." }, 409);
    return apiJson({ success: false, message: "Report could not be submitted." }, 500);
  }
}
