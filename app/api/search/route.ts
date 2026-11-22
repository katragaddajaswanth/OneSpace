import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, pageInfo, parsePage } from "@/lib/prototype-api";
import { connection } from "next/server";

const categories = ["users", "projects", "communities", "mentors", "opportunities", "skills", "certifications"] as const;

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const url = new URL(request.url);
    const page = parsePage(request.url, 12, 50);
    const query = (url.searchParams.get("q") ?? "").trim();
    const category = url.searchParams.get("category") ?? "all";
    if (!page || query.length < 2 || query.length > 100 || !["all", ...categories].includes(category) || [...url.searchParams.keys()].some((key) => !["q", "category", "page", "limit"].includes(key))) {
      return apiJson({ success: false, message: "Provide a search term of 2–100 characters and supported filters." }, 400);
    }

    const universityId = auth.user.universityId;
    const include = (name: typeof categories[number]) => category === "all" || category === name;
    const searches: Array<{ type: string; items: Array<{ id: string; title: string; subtitle?: string; href: string; createdAt?: Date }> }> = [];
    const take = Math.min(page.skip + page.limit, 250);

    const [users, projects, communities, mentors, opportunities, skills, certifications] = await Promise.all([
      include("users") ? prisma.user.findMany({ where: { universityId, accountStatus: "ACTIVE", emailVerified: true, OR: [{ fullName: { contains: query, mode: "insensitive" } }, { department: { name: { contains: query, mode: "insensitive" } } }, { program: { name: { contains: query, mode: "insensitive" } } }], unifiedProfile: { is: { visibility: { in: ["UNIVERSITY", "PUBLIC"] } } } }, orderBy: { fullName: "asc" }, take, select: { id: true, fullName: true, primaryRole: true, department: { select: { name: true } } } }) : [],
      include("projects") ? prisma.project.findMany({ where: { universityId, status: { in: ["OPEN", "IN_PROGRESS", "COMPLETED"] }, visibility: "UNIVERSITY", OR: [{ title: { contains: query, mode: "insensitive" } }, { theme: { contains: query, mode: "insensitive" } }, { problemStatement: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }, { requiredSkills: { has: query } }] }, orderBy: { createdAt: "desc" }, take, select: { id: true, title: true, category: true, createdAt: true } }) : [],
      include("communities") ? prisma.community.findMany({ where: { universityId, status: "APPROVED", OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }] }, orderBy: { name: "asc" }, take, select: { id: true, name: true, category: true, createdAt: true } }) : [],
      include("mentors") ? prisma.mentorProfile.findMany({ where: { enabled: true, available: true, user: { universityId, accountStatus: "ACTIVE", emailVerified: true, unifiedProfile: { is: { visibility: { in: ["UNIVERSITY", "PUBLIC"] } } }, OR: [{ fullName: { contains: query, mode: "insensitive" } }, { department: { name: { contains: query, mode: "insensitive" } } }] }, OR: [{ bio: { contains: query, mode: "insensitive" } }, { expertise: { has: query } }] }, take, select: { id: true, bio: true, expertise: true, user: { select: { fullName: true } } } }) : [],
      include("opportunities") ? prisma.opportunity.findMany({ where: { universityId, status: "APPROVED", publishedAt: { not: null }, closedAt: null, applicationDeadline: { gt: new Date() }, OR: [{ title: { contains: query, mode: "insensitive" } }, { organization: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { requiredSkills: { contains: query, mode: "insensitive" } }] }, orderBy: { publishedAt: "desc" }, take, select: { id: true, title: true, organization: true, publishedAt: true } }) : [],
      include("skills") ? prisma.profileSkillVerification.findMany({ where: { status: "VERIFIED", skill: { contains: query, mode: "insensitive" }, profile: { user: { universityId, accountStatus: "ACTIVE", unifiedProfile: { is: { visibility: { in: ["UNIVERSITY", "PUBLIC"] } } } } } }, take, select: { id: true, skill: true, profile: { select: { user: { select: { id: true, fullName: true } } } } } }) : [],
      include("certifications") ? prisma.profileCertification.findMany({ where: { status: "VERIFIED", OR: [{ title: { contains: query, mode: "insensitive" } }, { issuer: { contains: query, mode: "insensitive" } }], profile: { user: { universityId, accountStatus: "ACTIVE", unifiedProfile: { is: { visibility: { in: ["UNIVERSITY", "PUBLIC"] } } } } } }, take, select: { id: true, title: true, issuer: true, profile: { select: { user: { select: { id: true, fullName: true } } } } } }) : [],
    ]);

    if (include("users")) searches.push({ type: "user", items: users.map((item) => ({ id: item.id, title: item.fullName, subtitle: `${item.primaryRole.replaceAll("_", " ")}${item.department ? ` · ${item.department.name}` : ""}`, href: `/profiles/${item.id}` })) });
    if (include("projects")) searches.push({ type: "project", items: projects.map((item) => ({ id: item.id, title: item.title, subtitle: item.category, href: `/projects?project=${encodeURIComponent(item.id)}`, createdAt: item.createdAt })) });
    if (include("communities")) searches.push({ type: "community", items: communities.map((item) => ({ id: item.id, title: item.name, subtitle: item.category, href: `/communities?community=${encodeURIComponent(item.id)}`, createdAt: item.createdAt })) });
    if (include("mentors")) searches.push({ type: "mentor", items: mentors.map((item) => ({ id: item.id, title: item.user.fullName, subtitle: item.expertise.join(", "), href: "/mentorship" })) });
    if (include("opportunities")) searches.push({ type: "opportunity", items: opportunities.map((item) => ({ id: item.id, title: item.title, subtitle: item.organization, href: "/opportunities", createdAt: item.publishedAt ?? undefined })) });
    if (include("skills")) searches.push({ type: "skill", items: skills.map((item) => ({ id: item.id, title: item.skill, subtitle: `Verified skill · ${item.profile.user.fullName}`, href: `/profiles/${encodeURIComponent(item.profile.user.id)}` })) });
    if (include("certifications")) searches.push({ type: "certification", items: certifications.map((item) => ({ id: item.id, title: item.title, subtitle: `${item.issuer} · ${item.profile.user.fullName}`, href: `/profiles/${encodeURIComponent(item.profile.user.id)}` })) });

    const all = searches.flatMap((group) => group.items.map((item) => ({ ...item, type: group.type }))).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    const results = all.slice(page.skip, page.skip + page.limit).map(({ createdAt, ...item }) => item);
    return apiJson({ success: true, results, pagination: pageInfo(page.page, page.limit, all.length) });
  } catch {
    return apiJson({ success: false, message: "Search could not be completed." }, 500);
  }
}
