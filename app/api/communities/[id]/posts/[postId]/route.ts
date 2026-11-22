import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function DELETE(request: Request, context: { params: Promise<{ id: string; postId: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id, postId } = await context.params;
    const result = await prisma.communityPost.updateMany({ where: { id: postId, communityId: id, authorId: auth.user.id, deletedAt: null, community: { universityId: auth.user.universityId } }, data: { deletedAt: new Date() } });
    if (!result.count) return apiJson({ success: false, message: "Discussion post not found." }, 404);
    return apiJson({ success: true, message: "Discussion post removed." });
  } catch {
    return apiJson({ success: false, message: "Discussion post could not be removed." }, 500);
  }
}
