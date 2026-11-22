import type { Prisma } from "@/generated/prisma/client";
import { opportunityUniversityScope, requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connection } from "next/server";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE_NO_STORE });
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

type SaveContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: SaveContext) {
  await connection();

  try {
    const authorization = await requireUniversityUser(request);
    if (authorization.response) return authorization.response;

    const { user } = authorization;
    if (user.primaryRole !== "STUDENT") {
      return json({ success: false, message: "Only students can save opportunities." }, 403);
    }

    // Save has no client-controlled data. If a body is sent, reject any fields
    // so forged identity or university values cannot be mistaken for authority.
    if (request.body) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ success: false, message: "Request body must contain valid JSON." }, 400);
      }

      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) {
        return json({
          success: false,
          message: "This endpoint does not accept request fields.",
        }, 400);
      }
    }

    const { id: opportunityId } = await context.params;
    const now = new Date();
    const eligibleOpportunity = await prisma.opportunity.findFirst({
      where: {
        ...opportunityUniversityScope(user),
        id: opportunityId,
        status: "APPROVED",
        publishedAt: { not: null },
        applicationDeadline: { gt: now },
        closedAt: null,
      },
      select: { id: true },
    });

    if (!eligibleOpportunity) {
      return json({ success: false, message: "Opportunity not found or unavailable." }, 404);
    }

    const saved = await prisma.savedOpportunity.create({
      data: { opportunityId: eligibleOpportunity.id, studentId: user.id },
      select: { id: true, opportunityId: true, savedAt: true },
    });

    return json({ success: true, saved }, 201);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return json({ success: false, message: "Opportunity is already saved." }, 409);
    }

    return json({ success: false, message: "Opportunity could not be saved." }, 500);
  }
}

export async function DELETE(request: Request, context: SaveContext) {
  await connection();

  try {
    const authorization = await requireUniversityUser(request);
    if (authorization.response) return authorization.response;

    const { user } = authorization;
    if (user.primaryRole !== "STUDENT") {
      return json({ success: false, message: "Only students can remove saved opportunities." }, 403);
    }

    const { id: opportunityId } = await context.params;
    const where: Prisma.SavedOpportunityWhereInput = {
      opportunityId,
      studentId: user.id,
      opportunity: {
        is: opportunityUniversityScope(user),
      },
    };
    const removed = await prisma.savedOpportunity.deleteMany({ where });

    if (removed.count === 0) {
      return json({ success: false, message: "Saved opportunity not found." }, 404);
    }

    return json({ success: true, message: "Opportunity removed from saved items." });
  } catch {
    return json({ success: false, message: "Saved opportunity could not be removed." }, 500);
  }
}
