import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, pageInfo, parsePage, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 30 && value.every((item) => typeof item === "string" && item.trim().length > 0 && item.trim().length <= 80);
}

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
    if (search.length > 100 || [...params.keys()].some((key) => !["page", "limit", "search", "category", "mine"].includes(key))) return apiJson({ success: false, message: "Unsupported or invalid project filters." }, 400);
    const mine = params.get("mine") === "true";
    const where: Prisma.ProjectWhereInput = {
      universityId: auth.user.universityId,
      ...(mine ? { leadId: auth.user.id } : { status: { in: ["OPEN", "IN_PROGRESS", "COMPLETED"] } }),
      ...(category ? { category } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { description: { contains: search, mode: "insensitive" as const } }, { problemStatement: { contains: search, mode: "insensitive" as const } }, { theme: { contains: search, mode: "insensitive" as const } }] } : {}),
    };
    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit, select: { id: true, title: true, description: true, category: true, theme: true, problemStatement: true, requiredSkills: true, status: true, visibility: true, coverImageUrl: true, createdAt: true, lead: { select: { id: true, fullName: true } }, _count: { select: { members: true, joinRequests: { where: { status: "PENDING" } } } } } }),
      prisma.project.count({ where }),
    ]);
    return apiJson({ success: true, projects, pagination: pageInfo(pagination.page, pagination.limit, total) });
  } catch {
    return apiJson({ success: false, message: "Projects could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole !== "STUDENT") return apiJson({ success: false, message: "Only students may start projects." }, 403);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["title", "description", "category", "theme", "problemStatement", "requiredSkills", "objectives", "outcomes", "visibility", "coverImageUrl"]);
    if (invalid) return invalid;
    const title = requiredText(parsed.body, "title", 160);
    const description = requiredText(parsed.body, "description", 5000);
    const category = requiredText(parsed.body, "category", 100);
    const theme = requiredText(parsed.body, "theme", 160);
    const problemStatement = requiredText(parsed.body, "problemStatement", 3000);
    if (!title || !description || !category || !theme || !problemStatement) return apiJson({ success: false, message: "Title, description, category, theme, and problem statement are required." }, 400);
    const requiredSkills = parsed.body.requiredSkills ?? [];
    if (!stringList(requiredSkills)) return apiJson({ success: false, message: "Required skills must be a list of up to 30 short values." }, 400);
    const visibility = parsed.body.visibility ?? "UNIVERSITY";
    if (!["UNIVERSITY", "PRIVATE"].includes(String(visibility))) return apiJson({ success: false, message: "Unsupported project visibility." }, 400);
    const coverImageUrl = parsed.body.coverImageUrl === undefined || parsed.body.coverImageUrl === null || parsed.body.coverImageUrl === "" ? null : typeof parsed.body.coverImageUrl === "string" && /^https?:\/\//i.test(parsed.body.coverImageUrl) && parsed.body.coverImageUrl.length <= 2048 ? parsed.body.coverImageUrl : undefined;
    if (coverImageUrl === undefined) return apiJson({ success: false, message: "Cover image must be an HTTP or HTTPS URL." }, 400);
    const objectives = typeof parsed.body.objectives === "string" ? parsed.body.objectives.trim() : "";
    const outcomes = typeof parsed.body.outcomes === "string" ? parsed.body.outcomes.trim() : "";
    if (objectives.length > 3000 || outcomes.length > 3000) return apiJson({ success: false, message: "Objectives and outcomes must be 3000 characters or fewer." }, 400);
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: { universityId: auth.user.universityId, leadId: auth.user.id, title, description, category, theme, problemStatement, requiredSkills: requiredSkills.map((item) => item.trim()), objectives, outcomes, visibility: visibility as "UNIVERSITY" | "PRIVATE", coverImageUrl, status: "DRAFT" },
        select: { id: true, title: true, status: true, createdAt: true },
      });
      await tx.projectMember.create({ data: { projectId: created.id, userId: auth.user.id } });
      return created;
    });
    return apiJson({ success: true, project }, 201);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return apiJson({ success: false, message: "A project with this title already exists in your university." }, 409);
    return apiJson({ success: false, message: "Project could not be created." }, 500);
  }
}
