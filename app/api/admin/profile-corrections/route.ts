import { requireUniversityRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, parsePage, pageInfo } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityRoles(["ADMINISTRATOR"] as const, "Administrator access is required.", request);
    if (auth.response) return auth.response;
    const pagination = parsePage(request.url, 20, 50);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const where = { status: "PENDING" as const, profile: { user: { universityId: auth.user.universityId } } };
    const [corrections, total] = await Promise.all([
      prisma.profileCorrection.findMany({ where, orderBy: { createdAt: "asc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, field: true, proposedValue: true, reason: true, createdAt: true, user: { select: { id: true, fullName: true, primaryRole: true } } } }),
      prisma.profileCorrection.count({ where }),
    ]);
    return apiJson({ success: true, corrections, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Profile correction queue could not be loaded." }, 500);
  }
}
