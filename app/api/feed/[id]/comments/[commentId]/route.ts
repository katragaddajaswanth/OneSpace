import { requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function DELETE(request: Request, context: { params: Promise<{ id: string; commentId: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    const { id, commentId } = await context.params;
    const result = await prisma.postComment.updateMany({
      where: { id: commentId, postId: id, userId: auth.user.id, deletedAt: null, post: { universityId: auth.user.universityId } },
      data: { deletedAt: new Date() },
    });
    if (!result.count) return apiJson({ success: false, message: "Comment not found." }, 404);
    return apiJson({ success: true, message: "Comment removed." });
  } catch {
    return apiJson({ success: false, message: "Comment could not be removed." }, 500);
  }
}
