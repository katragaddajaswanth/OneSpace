import type { Prisma } from "@/generated/prisma/client";
import { opportunityUniversityScope, requireUniversityUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connection } from "next/server";

const MAX_MESSAGE_LENGTH = 5_000;
const MAX_RESUME_URL_LENGTH = 2_048;

type ApplicationInput = {
  message: string | null;
  resumeUrl: string | null;
};

function parseApplicationInput(body: unknown): {
  input?: ApplicationInput;
  errors?: Record<string, string>;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "Request body must be a JSON object." } };
  }

  const data = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const field of Object.keys(data)) {
    if (field !== "message" && field !== "resumeUrl") {
      errors[field] = "This field is not accepted.";
    }
  }

  let message: string | null = null;
  if (data.message !== undefined && data.message !== null) {
    if (typeof data.message !== "string") {
      errors.message = "Message must be a string.";
    } else {
      const trimmedMessage = data.message.trim();
      if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
        errors.message = `Message must be no more than ${MAX_MESSAGE_LENGTH} characters.`;
      } else if (trimmedMessage) {
        message = trimmedMessage;
      }
    }
  }

  let resumeUrl: string | null = null;
  if (data.resumeUrl !== undefined && data.resumeUrl !== null) {
    if (typeof data.resumeUrl !== "string") {
      errors.resumeUrl = "Resume URL must be a string.";
    } else {
      const trimmedUrl = data.resumeUrl.trim();
      if (trimmedUrl.length > MAX_RESUME_URL_LENGTH) {
        errors.resumeUrl = `Resume URL must be no more than ${MAX_RESUME_URL_LENGTH} characters.`;
      } else if (trimmedUrl) {
        try {
          const parsedUrl = new URL(trimmedUrl);
          if (
            !["http:", "https:"].includes(parsedUrl.protocol) ||
            !parsedUrl.hostname ||
            parsedUrl.username ||
            parsedUrl.password
          ) {
            errors.resumeUrl = "Enter a valid HTTP or HTTPS resume URL.";
          } else {
            resumeUrl = trimmedUrl;
          }
        } catch {
          errors.resumeUrl = "Enter a valid HTTP or HTTPS resume URL.";
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { input: { message, resumeUrl } };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

type ApplyContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: ApplyContext) {
  await connection();

  try {
    const authorization = await requireUniversityUser(request);
    if (authorization.response) return authorization.response;

    const { user } = authorization;
    if (user.primaryRole !== "STUDENT") {
      return Response.json(
        { success: false, message: "Only students can apply to opportunities." },
        { status: 403 }
      );
    }

    const { id: opportunityId } = await context.params;
    const now = new Date();
    const opportunityWhere: Prisma.OpportunityWhereInput = {
      ...opportunityUniversityScope(user),
      id: opportunityId,
      status: "APPROVED",
      publishedAt: { not: null },
      applicationDeadline: { gt: now },
      closedAt: null,
    };

    const eligibleOpportunity = await prisma.opportunity.findFirst({
      where: opportunityWhere,
      select: { id: true },
    });

    if (!eligibleOpportunity) {
      return Response.json(
        { success: false, message: "Opportunity not found or is not eligible for applications." },
        { status: 404 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, message: "Request body must contain valid JSON." },
        { status: 400 }
      );
    }

    const parsed = parseApplicationInput(body);
    if (!parsed.input) {
      return Response.json(
        {
          success: false,
          message: "Please correct the application fields.",
          errors: parsed.errors,
        },
        { status: 400 }
      );
    }

    const application = await prisma.opportunityApplication.create({
      data: {
        opportunityId: eligibleOpportunity.id,
        studentId: user.id,
        message: parsed.input.message,
        resumeUrl: parsed.input.resumeUrl,
        // ApplicationStatus has no PENDING value; APPLIED is its schema-defined initial state.
        status: "APPLIED",
      },
      select: {
        id: true,
        status: true,
        appliedAt: true,
      },
    });

    return Response.json(
      {
        success: true,
        message: "Application submitted successfully.",
        application,
      },
      { status: 201 }
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json(
        { success: false, message: "You have already applied to this opportunity." },
        { status: 409 }
      );
    }

    return Response.json(
      { success: false, message: "Application could not be submitted." },
      { status: 500 }
    );
  }
}
