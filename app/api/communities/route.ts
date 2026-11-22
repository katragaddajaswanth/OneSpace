import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, pageInfo, parsePage, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const pagination = parsePage(request.url);
    if (!pagination) return apiJson({ success: false, message: "Invalid pagination." }, 400);
    const params = new URL(request.url).searchParams;
    const search = (params.get("search") ?? "").trim();
    const category = params.get("category");
    const mine = params.get("mine") === "true";
    if (search.length > 100 || [...params.keys()].some((key) => !["page", "limit", "search", "category", "mine"].includes(key))) return apiJson({ success: false, message: "Unsupported or invalid filters." }, 400);
    const where = {
      universityId: auth.user.universityId,
      ...(mine ? { OR: [{ createdById: auth.user.id }, { memberships: { some: { userId: auth.user.id } } }] } : { status: "APPROVED" as const }),
      ...(category ? { category } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { description: { contains: search, mode: "insensitive" as const } }, { tags: { has: search } }] } : {}),
    };
    const [communities, total] = await Promise.all([
      prisma.community.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, name: true, description: true, category: true, tags: true, privacy: true, status: true, createdAt: true, createdById: true, creator: { select: { id: true, fullName: true } }, _count: { select: { memberships: { where: { status: "APPROVED" } }, posts: { where: { deletedAt: null } } } }, memberships: { where: { userId: auth.user.id }, select: { status: true }, take: 1 } } }),
      prisma.community.count({ where }),
    ]);
    return apiJson({ success: true, communities: communities.map((item) => ({ ...item, myMembershipStatus: item.memberships[0]?.status ?? null, memberships: undefined })), pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Communities could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") return apiJson({ success: false, message: "Community creation is unavailable to prospective students." }, 403);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["name", "description", "category", "tags", "privacy"]);
    if (invalid) return invalid;
    const name = requiredText(parsed.body, "name", 100);
    const description = requiredText(parsed.body, "description", 3000);
    const category = requiredText(parsed.body, "category", 80);
    const tags = parsed.body.tags ?? [];
    const privacy = parsed.body.privacy ?? "OPEN";
    if (!name || !description || !category) return apiJson({ success: false, message: "Name, description, and category are required." }, 400);
    if (!Array.isArray(tags) || tags.length > 30 || tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 60)) return apiJson({ success: false, message: "Tags must be a list of up to 30 short values." }, 400);
    if (!["OPEN", "APPROVAL_REQUIRED"].includes(String(privacy))) return apiJson({ success: false, message: "Select a valid community privacy setting." }, 400);
    const community = await prisma.$transaction(async (tx) => {
      const item = await tx.community.create({ data: { universityId: auth.user.universityId, createdById: auth.user.id, name, description, category, tags: [...new Set((tags as string[]).map((tag) => tag.trim()))], privacy: privacy as "OPEN" | "APPROVAL_REQUIRED", status: "PENDING" }, select: { id: true, name: true, status: true, createdAt: true } });
      await tx.communityMembership.create({ data: { communityId: item.id, userId: auth.user.id, status: "APPROVED" } });
      return item;
    });
    return apiJson({ success: true, community, message: "Community submitted for Administrator approval." }, 201);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return apiJson({ success: false, message: "A community with this name already exists." }, 409);
    return apiJson({ success: false, message: "Community could not be created." }, 500);
  }
}
