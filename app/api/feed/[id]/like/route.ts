import { requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const post = await prisma.universityPost.findFirst({ where: { id, universityId: auth.user.universityId, status: "APPROVED" }, select: { id: true } });
    if (!post) return apiJson({ success: false, message: "Post not found." }, 404);
    await prisma.postLike.upsert({
      where: { postId_userId: { postId: id, userId: auth.user.id } },
      create: { postId: id, userId: auth.user.id },
      update: { removedAt: null },
    });
    return apiJson({ success: true }, 201);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return apiJson({ success: false, message: "Post is already liked." }, 409);
    return apiJson({ success: false, message: "Like could not be added." }, 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const result = await prisma.postLike.updateMany({ where: { postId: id, userId: auth.user.id, removedAt: null, post: { universityId: auth.user.universityId } }, data: { removedAt: new Date() } });
    if (!result.count) return apiJson({ success: false, message: "Like not found." }, 404);
    return apiJson({ success: true });
  } catch {
    return apiJson({ success: false, message: "Like could not be removed." }, 500);
  }
}
