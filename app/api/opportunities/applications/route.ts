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
    if (key !== "page" && key !== "limit") {
      errors[key] = "This query parameter is not supported.";
    }
    if (params.getAll(key).length > 1) {
      errors[key] = "Provide this query parameter only once.";
    }
  }

  function positiveInteger(key: "page" | "limit", fallback: number): number {
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

  const page = positiveInteger("page", 1);
  const limit = positiveInteger("limit", 12);
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
      return json({ success: false, message: "Only students can view applications." }, 403);
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

    const where: Prisma.OpportunityApplicationWhereInput = {
      studentId: user.id,
      student: {
        is: {
          id: user.id,
          universityId: user.universityId,
          primaryRole: "STUDENT",
        },
      },
      opportunity: {
        is: opportunityUniversityScope(user),
      },
    };

    stage = "prisma_queries";
    const [applications, total] = await Promise.all([
      prisma.opportunityApplication.findMany({
        where,
        orderBy: [{ appliedAt: "desc" }, { id: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          id: true,
          status: true,
          appliedAt: true,
          opportunity: {
            select: {
              id: true,
              title: true,
              organization: true,
              type: true,
              location: true,
              workMode: true,
              applicationDeadline: true,
            },
          },
        },
      }),
      prisma.opportunityApplication.count({ where }),
    ]);

    stage = "response_serialization";
    return json({
      success: true,
      applications,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    return serverErrorResponse(
      "GET /api/opportunities/applications",
      error,
      stage,
      "Applications could not be retrieved."
    );
  }
}
