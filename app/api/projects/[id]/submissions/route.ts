import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["title", "description", "url"]);
    if (invalid) return invalid;
    const title = requiredText(parsed.body, "title", 200);
    const description = requiredText(parsed.body, "description", 5000);
    if (!title || !description) return apiJson({ success: false, message: "Submission title and description are required." }, 400);
    let url: string | null = null;
    if (parsed.body.url !== undefined && parsed.body.url !== null && parsed.body.url !== "") {
      if (typeof parsed.body.url !== "string" || parsed.body.url.length > 2048 || !/^https?:\/\//i.test(parsed.body.url)) return apiJson({ success: false, message: "Submission URL must be HTTP or HTTPS." }, 400);
      url = parsed.body.url;
    }
    const project = await prisma.project.findFirst({ where: { id, universityId: auth.user.universityId, status: { in: ["OPEN", "IN_PROGRESS"] }, members: { some: { userId: auth.user.id } } }, select: { id: true } });
    if (!project) return apiJson({ success: false, message: "Project not found or you are not a member." }, 404);
    const submission = await prisma.projectSubmission.create({ data: { projectId: id, submittedById: auth.user.id, title, description, url } });
    return apiJson({ success: true, submission }, 201);
  } catch {
    return apiJson({ success: false, message: "Project submission could not be saved." }, 500);
  }
}
