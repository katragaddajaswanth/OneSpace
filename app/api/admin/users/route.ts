import { requireUniversityRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, pageInfo, parsePage } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityRoles(["ADMINISTRATOR"] as const, "Administrator access is required.", request);
    if (auth.response) return auth.response;
    const pagination = parsePage(request.url);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const params = new URL(request.url).searchParams;
    const search = (params.get("search") ?? "").trim();
    if (search.length > 100 || [...params.keys()].some((key) => !["page", "limit", "search"].includes(key))) return apiJson({ success: false, message: "Unsupported user filter." }, 400);
    const where = {
      universityId: auth.user.universityId,
      ...(search ? { OR: [{ fullName: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } : {}),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, fullName: true, email: true, primaryRole: true, accountStatus: true, emailVerified: true, createdAt: true, secondaryRoles: { select: { role: true, assignedAt: true } }, department: { select: { name: true } }, program: { select: { name: true } } } }),
      prisma.user.count({ where }),
    ]);
    return apiJson({ success: true, users, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Users could not be loaded." }, 500);
  }
}
