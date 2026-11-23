import { requireUniversityUser, requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

const types = ["ACHIEVEMENT", "PROJECT", "LINK"] as const;
function validUrl(value: unknown): value is string | null { if (value === null || value === undefined || value === "") return true; if (typeof value !== "string" || value.length > 2048) return false; try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; } }

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request); if (auth.response) return auth.response;
    const items = await prisma.profilePortfolioItem.findMany({ where: { userId: auth.user.id, profile: { user: { universityId: auth.user.universityId } } }, orderBy: { createdAt: "desc" }, select: { id: true, type: true, title: true, description: true, url: true, verifiedAt: true, createdAt: true } });
    return apiJson({ success: true, achievements: items });
  } catch { return apiJson({ success: false, message: "Portfolio items could not be loaded." }, 500); }
}

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request); if (auth.response) return auth.response;
    const parsed = await readJsonObject(request); if (parsed.response) return parsed.response;
    const unexpected = rejectUnexpectedFields(parsed.body, ["type", "title", "description", "url"]); if (unexpected) return unexpected;
    const type = parsed.body.type; const title = requiredText(parsed.body, "title", 200);
    if (typeof type !== "string" || !types.includes(type as (typeof types)[number]) || !title) return apiJson({ success: false, message: "Provide a valid portfolio type and title." }, 400);
    const description = parsed.body.description === undefined ? "" : typeof parsed.body.description === "string" ? parsed.body.description.trim() : null;
    if (description === null || description.length > 3000 || !validUrl(parsed.body.url)) return apiJson({ success: false, message: "Description or URL is invalid." }, 400);
    const profile = await prisma.unifiedProfile.upsert({ where: { userId: auth.user.id }, create: { userId: auth.user.id }, update: {}, select: { id: true } });
    const item = await prisma.profilePortfolioItem.create({ data: { profileId: profile.id, userId: auth.user.id, type: type as (typeof types)[number], title, description, url: typeof parsed.body.url === "string" && parsed.body.url ? parsed.body.url : null }, select: { id: true, type: true, title: true, description: true, url: true, createdAt: true } });
    return apiJson({ success: true, achievement: item }, 201);
  } catch { return apiJson({ success: false, message: "Portfolio item could not be saved." }, 500); }
}
