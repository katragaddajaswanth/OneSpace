import { requireUniversityRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityRoles(["ADMINISTRATOR"] as const, "Administrator access is required.", request);
    if (auth.response) return auth.response;
    const universityId = auth.user.universityId;
    const [users, pendingCorrections, pendingCommunities, pendingProjects, pendingPosts, pendingReports, pendingOpportunities] = await Promise.all([
      prisma.user.count({ where: { universityId } }),
      prisma.profileCorrection.count({ where: { status: "PENDING", profile: { user: { universityId } } } }),
      prisma.community.count({ where: { universityId, status: "PENDING" } }),
      prisma.project.count({ where: { universityId, status: "PENDING_PROCTOR_APPROVAL" } }),
      prisma.universityPost.count({ where: { universityId, status: "PENDING" } }),
      prisma.postReport.count({ where: { status: "PENDING", post: { universityId } } }),
      prisma.opportunity.count({ where: { universityId, status: "PENDING", submitter: { universityId } } }),
    ]);
    return apiJson({ success: true, stats: { users, pendingCorrections, pendingCommunities, pendingProjects, pendingPosts, pendingReports, pendingOpportunities } });
  } catch {
    return apiJson({ success: false, message: "Administrator overview could not be loaded." }, 500);
  }
}
