import { prisma } from "@/lib/prisma";
import { apiJson } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  const slug = new URL(request.url).searchParams.get("universitySlug") ?? "demo-university";
  try {
    const university = await prisma.university.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        departments: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, programs: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
        },
      },
    });
    if (!university) return apiJson({ success: false, message: "University is unavailable." }, 404);
    return apiJson({
      success: true,
      university: { id: university.id, name: university.name, slug: university.slug },
      departments: university.departments,
    });
  } catch {
    return apiJson({ success: false, message: "Registration options could not be loaded." }, 500);
  }
}
