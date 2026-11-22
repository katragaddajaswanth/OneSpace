import {
  CompensationType,
  OpportunityType,
  WorkMode,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import {
  opportunityUniversityScope,
  requireUniversityRoles,
  requireUniversityUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serverErrorResponse } from "@/lib/server-error-logging";
import { connection } from "next/server";

type SubmissionInput = {
  title: string;
  organization: string;
  description: string;
  type: (typeof OpportunityType)[keyof typeof OpportunityType];
  compensationType: (typeof CompensationType)[keyof typeof CompensationType];
  location: string | null;
  workMode: (typeof WorkMode)[keyof typeof WorkMode];
  eligibility: string;
  requiredSkills: string | null;
  applicationDeadline: Date;
  applicationUrl: string | null;
};

const MAX_REQUEST_BODY_BYTES = 32 * 1024;

const allowedFields = new Set([
  "title",
  "organization",
  "description",
  "type",
  "compensationType",
  "location",
  "workMode",
  "eligibility",
  "requiredSkills",
  "skills",
  "applicationDeadline",
  "deadline",
  "applicationUrl",
]);

const opportunityTypes = new Set<string>(Object.values(OpportunityType));
const compensationTypes = new Set<string>(Object.values(CompensationType));
const workModes = new Set<string>(Object.values(WorkMode));

const allowedDiscoveryParameters = new Set([
  "search",
  "type",
  "workMode",
  "compensationType",
  "page",
  "limit",
  "sort",
]);

const ignoredTrackingParameters = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
]);

type DiscoveryQuery = {
  search?: string;
  type?: (typeof OpportunityType)[keyof typeof OpportunityType];
  workMode?: (typeof WorkMode)[keyof typeof WorkMode];
  compensationType?: (typeof CompensationType)[keyof typeof CompensationType];
  page: number;
  limit: number;
  sort: "newest" | "deadline" | "oldest";
};

function parseDiscoveryQuery(url: string): {
  query?: DiscoveryQuery;
  errors?: Record<string, string>;
} {
  const searchParams = new URL(url).searchParams;
  const errors: Record<string, string> = {};

  for (const parameter of new Set(searchParams.keys())) {
    if (ignoredTrackingParameters.has(parameter.toLowerCase())) continue;
    if (!allowedDiscoveryParameters.has(parameter)) {
      errors[parameter] = "This query parameter is not supported.";
    }
    if (searchParams.getAll(parameter).length > 1) {
      errors[parameter] = "Provide this query parameter only once.";
    }
  }

  function getSingle(parameter: string): string | undefined {
    const values = searchParams.getAll(parameter);
    if (values.length > 1) return undefined;
    return values[0];
  }

  const searchValue = getSingle("search");
  const search = searchValue?.trim();
  if (searchValue !== undefined && !search) {
    errors.search = "Search cannot be empty.";
  }
  if (search && search.length > 200) {
    errors.search = "Search must be no more than 200 characters.";
  }

  const typeValue = getSingle("type");
  let type: DiscoveryQuery["type"];
  if (typeValue !== undefined) {
    if (opportunityTypes.has(typeValue)) {
      type = typeValue as DiscoveryQuery["type"];
    } else {
      errors.type = "Select a valid opportunity type.";
    }
  }

  const workModeValue = getSingle("workMode");
  let workMode: DiscoveryQuery["workMode"];
  if (workModeValue !== undefined) {
    if (workModes.has(workModeValue)) {
      workMode = workModeValue as DiscoveryQuery["workMode"];
    } else {
      errors.workMode = "Select a valid work mode.";
    }
  }

  const compensationValue = getSingle("compensationType");
  let compensationType: DiscoveryQuery["compensationType"];
  if (compensationValue !== undefined) {
    if (compensationTypes.has(compensationValue)) {
      compensationType = compensationValue as DiscoveryQuery["compensationType"];
    } else {
      errors.compensationType = "Select a valid compensation type.";
    }
  }

  function positiveInteger(parameter: string, fallback: number): number {
    const value = getSingle(parameter);
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) {
      errors[parameter] = "Must be a positive integer.";
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      errors[parameter] = "Must be a positive integer.";
      return fallback;
    }
    return parsed;
  }

  const page = positiveInteger("page", 1);
  const limit = positiveInteger("limit", 12);
  if (limit > 50) errors.limit = "Must be no more than 50.";
  if (!Number.isSafeInteger((page - 1) * limit)) {
    errors.page = "Page value is too large.";
  }

  const sortValue = getSingle("sort");
  const sort = sortValue ?? "newest";
  if (!["newest", "deadline", "oldest"].includes(sort)) {
    errors.sort = "Sort must be newest, deadline, or oldest.";
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    query: {
      ...(search ? { search } : {}),
      type,
      workMode,
      compensationType,
      page,
      limit,
      sort: sort as DiscoveryQuery["sort"],
    },
  };
}

type JsonBodyResult =
  | { success: true; body: unknown }
  | { success: false; status: 400 | 413; message: string };

function contentLengthExceedsLimit(request: Request): boolean {
  const contentLength = request.headers.get("content-length");
  if (!contentLength || !/^\d+$/.test(contentLength)) return false;

  return Number(contentLength) > MAX_REQUEST_BODY_BYTES;
}

async function readLimitedJsonBody(request: Request): Promise<JsonBodyResult> {
  if (!request.body) {
    return {
      success: false,
      status: 400,
      message: "Request body must contain valid JSON.",
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // Return 413 even if the client has already closed the stream.
        }
        return {
          success: false,
          status: 413,
          message: "Request body must not exceed 32 KB.",
        };
      }

      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { success: true, body: JSON.parse(text) as unknown };
  } catch {
    try {
      await reader.cancel();
    } catch {
      // The request stream may already be closed.
    }

    return {
      success: false,
      status: 400,
      message: "Request body must contain valid JSON.",
    };
  } finally {
    reader.releaseLock();
  }
}

function hasValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

function parseSubmission(body: unknown): {
  input?: SubmissionInput;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "Request body must be a JSON object." } };
  }

  const data = body as Record<string, unknown>;

  for (const field of Object.keys(data)) {
    if (!allowedFields.has(field)) {
      errors[field] = "This field is not accepted.";
    }
  }

  function requiredText(field: string, maxLength: number): string {
    const value = data[field];
    if (typeof value !== "string" || !value.trim()) {
      errors[field] = "This field is required.";
      return "";
    }

    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      errors[field] = `Must be no more than ${maxLength} characters.`;
    }
    return trimmed;
  }

  function optionalText(
    field: string,
    maxLength: number,
    alias?: string
  ): string | null {
    const value = data[field] ?? (alias ? data[alias] : undefined);
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") {
      errors[field] = "Must be a string.";
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > maxLength) {
      errors[field] = `Must be no more than ${maxLength} characters.`;
    }
    return trimmed;
  }

  const title = requiredText("title", 200);
  const organization = requiredText("organization", 200);
  const description = requiredText("description", 10_000);
  const eligibility = requiredText("eligibility", 5_000);
  const requiredSkills = optionalText("requiredSkills", 2_000, "skills");
  const location = optionalText("location", 200);
  const applicationUrl = optionalText("applicationUrl", 2_048);

  const rawType = data.type;
  const type = typeof rawType === "string" && opportunityTypes.has(rawType)
    ? rawType as SubmissionInput["type"]
    : OpportunityType.JOB;
  if (typeof rawType !== "string" || !opportunityTypes.has(rawType)) {
    errors.type = "Select a valid opportunity type.";
  }

  const rawCompensationType = data.compensationType;
  const compensationType = rawCompensationType === undefined
    ? CompensationType.NOT_SPECIFIED
    : typeof rawCompensationType === "string" && compensationTypes.has(rawCompensationType)
      ? rawCompensationType as SubmissionInput["compensationType"]
      : CompensationType.NOT_SPECIFIED;
  if (
    rawCompensationType !== undefined &&
    (typeof rawCompensationType !== "string" || !compensationTypes.has(rawCompensationType))
  ) {
    errors.compensationType = "Select a valid compensation type.";
  }

  const rawWorkMode = data.workMode;
  const workMode = rawWorkMode === undefined
    ? WorkMode.REMOTE
    : typeof rawWorkMode === "string" && workModes.has(rawWorkMode)
      ? rawWorkMode as SubmissionInput["workMode"]
      : WorkMode.REMOTE;
  if (
    rawWorkMode !== undefined &&
    (typeof rawWorkMode !== "string" || !workModes.has(rawWorkMode))
  ) {
    errors.workMode = "Select a valid work mode.";
  }

  const deadlineValue = data.applicationDeadline ?? data.deadline;
  let applicationDeadline: Date | null = null;
  if (typeof deadlineValue !== "string") {
    errors.applicationDeadline = "A valid application deadline is required.";
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineValue)) {
    const parsed = new Date(`${deadlineValue}T23:59:59.999Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== deadlineValue
    ) {
      errors.applicationDeadline = "Enter a valid calendar date.";
    } else {
      applicationDeadline = parsed;
    }
  } else {
    const isoDateTime = deadlineValue.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/
    );

    if (!isoDateTime) {
      errors.applicationDeadline = "Use YYYY-MM-DD or an ISO date-time with timezone.";
    } else {
      const [, yearPart, monthPart, dayPart, hourPart, minutePart, secondPart, , , , offsetHourPart, offsetMinutePart] = isoDateTime;
      const year = Number(yearPart);
      const month = Number(monthPart);
      const day = Number(dayPart);
      const hour = Number(hourPart);
      const minute = Number(minutePart);
      const second = secondPart === undefined ? 0 : Number(secondPart);
      const offsetHour = offsetHourPart === undefined ? 0 : Number(offsetHourPart);
      const offsetMinute = offsetMinutePart === undefined ? 0 : Number(offsetMinutePart);

      const validComponents =
        hasValidCalendarDate(year, month, day) &&
        hour <= 23 &&
        minute <= 59 &&
        second <= 59 &&
        offsetHour <= 23 &&
        offsetMinute <= 59;

      if (!validComponents) {
        errors.applicationDeadline = "Enter a valid date and time.";
      } else {
        const parsed = new Date(deadlineValue);
        if (!Number.isNaN(parsed.getTime())) applicationDeadline = parsed;
        else errors.applicationDeadline = "Enter a valid date and time.";
      }
    }
  }

  if (applicationDeadline && applicationDeadline.getTime() <= Date.now()) {
    errors.applicationDeadline = "The application deadline must be in the future.";
  }

  if (applicationUrl) {
    try {
      const parsedUrl = new URL(applicationUrl);
      if (
        !["http:", "https:"].includes(parsedUrl.protocol) ||
        !parsedUrl.hostname ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        errors.applicationUrl = "Enter a valid HTTP or HTTPS URL.";
      }
    } catch {
      errors.applicationUrl = "Enter a valid HTTP or HTTPS URL.";
    }
  }

  if (Object.keys(errors).length > 0 || !applicationDeadline) {
    return { errors };
  }

  return {
    input: {
      title,
      organization,
      description,
      type,
      compensationType,
      location,
      workMode,
      eligibility,
      requiredSkills,
      applicationDeadline,
      applicationUrl,
    },
  };
}

export async function POST(request: Request) {
  await connection();

  try {
    if (contentLengthExceedsLimit(request)) {
      return Response.json(
        { success: false, message: "Request body must not exceed 32 KB." },
        { status: 413 }
      );
    }

    const authorization = await requireUniversityRoles(
      ["ALUMNI", "INDUSTRY_REPRESENTATIVE"],
      "Only alumni and industry representatives may submit opportunities.",
      request
    );

    if (authorization.response) return authorization.response;

    const { user } = authorization;
    const university = await prisma.university.findFirst({
      where: {
        id: user.universityId,
        users: { some: { id: user.id } },
      },
      select: { isActive: true },
    });

    if (!university?.isActive) {
      return Response.json(
        { success: false, message: "Submissions are unavailable for this university." },
        { status: 403 }
      );
    }

    const submitterRole =
      // When both roles are assigned, preserve Alumni as the recorded role.
      user.primaryRole === "ALUMNI"
        ? "ALUMNI"
        : user.secondaryRoles.some(
              (assignedRole) => assignedRole.role === "INDUSTRY_REPRESENTATIVE"
            )
          ? "INDUSTRY_REPRESENTATIVE"
          : null;

    if (!submitterRole) {
      return Response.json(
        {
          success: false,
          message: "Only alumni and industry representatives may submit opportunities.",
        },
        { status: 403 }
      );
    }

    const bodyResult = await readLimitedJsonBody(request);
    if (!bodyResult.success) {
      return Response.json(
        { success: false, message: bodyResult.message },
        { status: bodyResult.status }
      );
    }

    const parsed = parseSubmission(bodyResult.body);
    if (!parsed.input) {
      return Response.json(
        {
          success: false,
          message: "Please correct the highlighted fields.",
          errors: parsed.errors,
        },
        { status: 400 }
      );
    }

    const opportunity = await prisma.opportunity.create({
      data: {
        ...parsed.input,
        submittedById: user.id,
        universityId: user.universityId,
        submitterRole,
        status: "PENDING",
      },
      select: {
        id: true,
        title: true,
        organization: true,
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
        createdAt: true,
      },
    });

    return Response.json(
      {
        success: true,
        message: "Opportunity submitted for approval.",
        opportunity,
      },
      { status: 201 }
    );
  } catch {
    return Response.json(
      { success: false, message: "Opportunity submission could not be completed." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  await connection();
  let stage = "authentication";
  try {
    const authorization = await requireUniversityUser(request);
    if (authorization.response) return authorization.response;

    const { user } = authorization;
    if (user.primaryRole !== "STUDENT") {
      return Response.json(
        { success: false, message: "Only students can browse opportunities." },
        { status: 403 }
      );
    }

    stage = "query_validation";
    const parsed = parseDiscoveryQuery(request.url);
    if (!parsed.query) {
      return Response.json(
        {
          success: false,
          message: "Invalid opportunity query parameters.",
          errors: parsed.errors,
        },
        { status: 400 }
      );
    }

    const query = parsed.query;
    const now = new Date();
    const where: Prisma.OpportunityWhereInput = {
      ...opportunityUniversityScope(user),
      status: "APPROVED",
      publishedAt: { not: null },
      applicationDeadline: { gt: now },
      ...(query.type ? { type: query.type } : {}),
      ...(query.workMode ? { workMode: query.workMode } : {}),
      ...(query.compensationType
        ? { compensationType: query.compensationType }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { organization: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { requiredSkills: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.OpportunityOrderByWithRelationInput[] = [
      query.sort === "deadline"
        ? { applicationDeadline: "asc" }
        : { createdAt: query.sort === "newest" ? "desc" : "asc" },
      { id: "asc" },
    ];
    const skip = (query.page - 1) * query.limit;

    stage = "prisma_queries";
    const findManyArgs = {
        where,
        orderBy,
        skip,
        take: query.limit,
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
          createdAt: true,
          publishedAt: true,
        },
      };
    const findManyPromise = Promise.resolve()
      .then(() => prisma.opportunity.findMany(findManyArgs))
      .catch((error: unknown) => {
        if (stage === "prisma_queries") stage = "prisma_findMany";
        throw error;
      });
    const countPromise = Promise.resolve()
      .then(() => prisma.opportunity.count({ where }))
      .catch((error: unknown) => {
        if (stage === "prisma_queries") stage = "prisma_count";
        throw error;
      });
    const [opportunities, total] = await Promise.all([findManyPromise, countPromise]);

    stage = "response_serialization";
    return Response.json(
      {
        success: true,
        opportunities,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return serverErrorResponse(
      "GET /api/opportunities",
      error,
      stage,
      "Opportunities could not be loaded."
    );
  }
}
