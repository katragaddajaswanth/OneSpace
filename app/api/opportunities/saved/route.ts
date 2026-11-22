import type { Prisma } from "@/generated/prisma/client";
import { opportunityUniversityScope, requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serverErrorResponse } from "@/lib/server-error-logging";
import { connection } from "next/server";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE_NO_STORE });
}

function privateResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function parsePagination(url: string):
  | { page: number; limit: number; skip: number }
  | { errors: Record<string, string> } {
  const params = new URL(url).searchParams;
  const errors: Record<string, string> = {};

  for (const key of new Set(params.keys())) {
    if (key !== "page" && key !== "limit") errors[key] = "This query parameter is not supported.";
    if (params.getAll(key).length > 1) errors[key] = "Provide this query parameter only once.";
  }

  function integer(key: "page" | "limit", fallback: number): number {
    const raw = params.get(key);
    if (raw === null) return fallback;
    if (!/^\d+$/.test(raw)) {
      errors[key] = "Must be a positive integer.";
      return fallback;
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1) {
      errors[key] = "Must be a positive integer.";
      return fallback;
    }
    return value;
  }

  const page = integer("page", 1);
  const limit = integer("limit", 12);
  if (limit > 50) errors.limit = "Must be no more than 50.";
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) errors.page = "Page value is too large.";

  return Object.keys(errors).length ? { errors } : { page, limit, skip };
}

export async function GET(request: Request) {
  await connection();
  let stage = "authentication";
  try {
    const authorization = await requireUniversityUser(request);
    if (authorization.response) return privateResponse(authorization.response);

    const { user } = authorization;
    if (user.primaryRole !== "STUDENT") {
      return json({ success: false, message: "Only students can view saved opportunities." }, 403);
    }

    stage = "query_validation";
    const pagination = parsePagination(request.url);
    if ("errors" in pagination) {
      return json({
        success: false,
        message: "Please correct the query parameters.",
        errors: pagination.errors,
      }, 400);
    }

    const now = new Date();
    const where: Prisma.SavedOpportunityWhereInput = {
      studentId: user.id,
      opportunity: {
        is: {
          ...opportunityUniversityScope(user),
          status: "APPROVED",
          publishedAt: { not: null },
          applicationDeadline: { gt: now },
          closedAt: null,
        },
      },
    };

    stage = "prisma_queries";
    const [saved, total] = await Promise.all([
      prisma.savedOpportunity.findMany({
        where,
        orderBy: { savedAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          savedAt: true,
          opportunity: {
            select: {
              id: true,
              title: true,
              organization: true,
              description: true,
              type: true,
              compensationType: true,
              location: true,
              workMode: true,
              eligibility: true,
              requiredSkills: true,
              applicationDeadline: true,
              applicationUrl: true,
              publishedAt: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.savedOpportunity.count({ where }),
    ]);

    stage = "response_serialization";
    return json({
      success: true,
      savedOpportunities: saved,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    return serverErrorResponse(
      "GET /api/opportunities/saved",
      error,
      stage,
      "Saved opportunities could not be retrieved."
    );
  }
}
