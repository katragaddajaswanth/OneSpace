
import { prisma } from "@/lib/prisma";
import { requireUniversityUser } from "@/lib/auth";
import { connection } from "next/server";

export async function GET(request: Request) {
  // Keep this outside the catch: Next.js uses a prerender interruption here
  // to defer the route until a real request arrives.
  await connection();

  try {
    const authorization = await requireUniversityUser(request);
    if (authorization.response) return authorization.response;

    await prisma.$queryRaw`SELECT 1`;

    return Response.json({ status: "ok" });
  } catch {
    // Log only a fixed event marker; Prisma errors may contain operational details.
    console.error("DATABASE_HEALTH_CHECK_FAILED");

    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
