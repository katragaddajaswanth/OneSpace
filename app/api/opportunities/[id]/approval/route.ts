import { requireUniversityRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connection } from "next/server";

type ReviewDecision = "APPROVE" | "REJECT";

type ReviewInput = {
  decision: ReviewDecision;
  reason: string | null;
};

type ReviewParseResult =
  | { input: ReviewInput; errors?: never }
  | { input?: never; errors: Record<string, string> };

function parseReviewInput(body: unknown): ReviewParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "Request body must be a JSON object." } };
  }

  const data = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const field of Object.keys(data)) {
    if (field !== "decision" && field !== "reason") {
      errors[field] = "This field is not accepted.";
    }
  }

  const decision = data.decision;
  if (decision !== "APPROVE" && decision !== "REJECT") {
    errors.decision = "Decision must be APPROVE or REJECT.";
  }

  let reason: string | null = null;
  if (data.reason !== undefined) {
    if (typeof data.reason !== "string") {
      errors.reason = "Reason must be a string.";
    } else {
      const trimmedReason = data.reason.trim();
      if (trimmedReason.length > 2_000) {
        errors.reason = "Reason must be no more than 2000 characters.";
      } else if (trimmedReason) {
        reason = trimmedReason;
      }
    }
  }

  if (decision === "REJECT" && (!reason || reason.length < 10)) {
    errors.reason = "Provide a meaningful rejection reason of at least 10 characters.";
  }

  if (Object.keys(errors).length > 0) return { errors };

  return { input: { decision: decision as ReviewDecision, reason } };
}

type PatchContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: PatchContext) {
  await connection();

  try {
    const authorization = await requireUniversityRoles(
      ["ADMINISTRATOR"],
      "Administrator access is required to review opportunities.",
      request
    );

    if (authorization.response) return authorization.response;

    const { user } = authorization;
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, message: "Request body must contain valid JSON." },
        { status: 400 }
      );
    }

    const parsed = parseReviewInput(body);
    if (!parsed.input) {
      return Response.json(
        {
          success: false,
          message: "Please correct the review fields.",
          errors: parsed.errors,
        },
        { status: 400 }
      );
    }

    const reviewedAt = new Date();
    const status = parsed.input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const decision = status;

    const result = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.opportunity.updateMany({
        where: {
          id,
          status: "PENDING",
          universityId: user.universityId,
          submitter: { is: { universityId: user.universityId } },
        },
        data:
          decision === "APPROVED"
            ? { status: decision, publishedAt: reviewedAt }
            : { status: decision },
      });

      if (updated.count === 0) {
        const existing = await transaction.opportunity.findUnique({
          where: { id },
          select: {
            universityId: true,
            status: true,
            submitter: { select: { universityId: true } },
          },
        });

        if (!existing) return { kind: "not-found" as const };
        if (
          existing.universityId !== user.universityId ||
          existing.submitter.universityId !== user.universityId
        ) {
          return { kind: "forbidden" as const };
        }

        return { kind: "conflict" as const };
      }

      await transaction.opportunityApproval.create({
        data: {
          opportunityId: id,
          reviewerId: user.id,
          decision,
          reason: parsed.input.reason,
          reviewedAt,
        },
      });

      return {
        kind: "reviewed" as const,
        opportunity: {
          id,
          status: decision,
          ...(decision === "APPROVED" ? { publishedAt: reviewedAt } : {}),
        },
        approval: {
          decision,
          reason: parsed.input.reason,
          reviewedAt,
        },
      };
    });

    if (result.kind === "not-found") {
      return Response.json(
        { success: false, message: "Opportunity not found." },
        { status: 404 }
      );
    }

    if (result.kind === "forbidden") {
      return Response.json(
        { success: false, message: "Opportunity is outside your university." },
        { status: 403 }
      );
    }

    if (result.kind === "conflict") {
      return Response.json(
        { success: false, message: "Opportunity is no longer pending review." },
        { status: 409 }
      );
    }

    return Response.json({
      success: true,
      opportunity: result.opportunity,
      approval: result.approval,
    });
  } catch {
    return Response.json(
      { success: false, message: "Opportunity review could not be completed." },
      { status: 500 }
    );
  }
}
