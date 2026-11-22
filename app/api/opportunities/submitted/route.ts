import type { Prisma } from "@/generated/prisma/client";
import { requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  try {
    const authorization = await requireUniversityUser(request);
    if (authorization.response) return privateResponse(authorization.response);

    const { user } = authorization;
    const isAlumni = user.primaryRole === "ALUMNI";
    const isIndustryRepresentative = user.secondaryRoles.some(
      (assignedRole) => assignedRole.role === "INDUSTRY_REPRESENTATIVE"
    );
    if (!isAlumni && !isIndustryRepresentative) {
      return json({
        success: false,
        message: "Only alumni and industry representatives can view submissions.",
      }, 403);
    }

    const pagination = parsePagination(request.url);
    if ("errors" in pagination) {
      return json({
        success: false,
        message: "Please correct the query parameters.",
        errors: pagination.errors,
      }, 400);
    }

    const where: Prisma.OpportunityWhereInput = {
      submittedById: user.id,
      universityId: user.universityId,
      submitter: {
        is: {
          id: user.id,
          universityId: user.universityId,
        },
      },
    };

    const [submissions, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          id: true,
          title: true,
          organization: true,
          description: true,
          type: true,
          submitterRole: true,
          compensationType: true,
          location: true,
          workMode: true,
          eligibility: true,
          requiredSkills: true,
          applicationDeadline: true,
          applicationUrl: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          approvalHistory: {
            orderBy: { reviewedAt: "desc" },
            take: 1,
            select: {
              decision: true,
              reason: true,
              reviewedAt: true,
            },
          },
        },
      }),
      prisma.opportunity.count({ where }),
    ]);

    return json({
      success: true,
      submissions,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch {
    return json({ success: false, message: "Submissions could not be retrieved." }, 500);
  }
}
