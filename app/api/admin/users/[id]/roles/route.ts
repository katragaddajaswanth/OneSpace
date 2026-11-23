import { SecondaryRole } from "@/generated/prisma/enums";
import { requireWritableUniversityRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const auth = await requireWritableUniversityRoles(["ADMINISTRATOR"] as const, "Administrator access is required.", request);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    if (id === auth.user.id) return apiJson({ success: false, message: "Administrators cannot grant roles to themselves." }, 403);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["role"]);
    if (invalid) return invalid;
    const role = parsed.body.role;
    if (typeof role !== "string" || !Object.values(SecondaryRole).includes(role as (typeof SecondaryRole)[keyof typeof SecondaryRole])) return apiJson({ success: false, message: "Select a valid secondary role." }, 400);
    const user = await prisma.user.findFirst({ where: { id, universityId: auth.user.universityId }, select: { id: true } });
    if (!user) return apiJson({ success: false, message: "University user not found." }, 404);
    const assignment = await prisma.userRole.upsert({ where: { userId_role: { userId: id, role: role as (typeof SecondaryRole)[keyof typeof SecondaryRole] } }, create: { userId: id, role: role as (typeof SecondaryRole)[keyof typeof SecondaryRole] }, update: {}, select: { id: true, role: true, assignedAt: true } });
    return apiJson({ success: true, assignment }, 201);
  } catch {
    return apiJson({ success: false, message: "Role assignment could not be saved." }, 500);
  }
}
