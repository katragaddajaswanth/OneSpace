import "server-only";

import { createHash } from "crypto";
import { cookies } from "next/headers";
import type { SecondaryRole } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "one_space_session";

const authenticatedUserInclude = {
  university: {
    select: { id: true, name: true, slug: true },
  },
  department: {
    select: { id: true, name: true, code: true },
  },
  program: {
    select: { id: true, name: true, code: true },
  },
  studentProfile: {
    select: { admissionYear: true, currentSemester: true, batch: true },
  },
  facultyProfile: {
    select: { designation: true, specialization: true, experienceYears: true },
  },
  secondaryRoles: {
    select: { role: true },
  },
} as const;

export type AuthenticatedUser = Prisma.UserGetPayload<{
  include: typeof authenticatedUserInclude;
}>;

export type UniversityAuthenticatedUser = AuthenticatedUser & {
  universityId: string;
};

export type AuthorizationResult<TUser> =
  | { user: TUser; response?: never }
  | { user?: never; response: Response };

type AuthenticationResult =
  | { user: AuthenticatedUser; failure?: never }
  | { user?: never; failure: "missing" | "invalid" };

export async function getAuthenticatedSession(
  request?: Request
): Promise<AuthenticationResult> {
  const token = request
    ? request.headers
        .get("cookie")
        ?.split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`))
        ?.slice(SESSION_COOKIE_NAME.length + 1)
    : (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return { failure: "missing" };
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    include: { user: { include: authenticatedUserInclude } },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.accountStatus !== "ACTIVE" ||
    !session.user.emailVerified
  ) {
    return { failure: "invalid" };
  }

  await prisma.userSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return { user: session.user };
}

/** Reads and verifies the current database-backed session from the request cookie. */
export async function getAuthenticatedUser(
  request?: Request
): Promise<AuthenticatedUser | null> {
  const session = await getAuthenticatedSession(request);
  return session.failure ? null : session.user;
}

/** Returns an HTTP 401 response when there is no valid authenticated session. */
export async function requireAuthenticatedUser(request?: Request): Promise<
  { user: AuthenticatedUser; response?: never } | { user?: never; response: Response }
> {
  const session = await getAuthenticatedSession(request);

  if (session.failure) {
    return {
      response: Response.json(
        {
          success: false,
          message:
            session.failure === "missing"
              ? "Authentication required."
              : "Session is invalid or expired.",
        },
        { status: 401 }
      ),
    };
  }

  return { user: session.user };
}

/** Requires a valid session and university membership from the database user. */
export async function requireUniversityUser(
  request?: Request
): Promise<AuthorizationResult<UniversityAuthenticatedUser>> {
  const authenticated = await requireAuthenticatedUser(request);
  if (authenticated.response) return authenticated;

  const { user } = authenticated;
  if (!user.universityId) {
    return {
      response: Response.json(
        { success: false, message: "University membership is required." },
        { status: 403 }
      ),
    };
  }

  return { user: user as UniversityAuthenticatedUser };
}

/** Authenticates from the session cookie, then returns HTTP 403 if no role matches. */
export async function requireRoles(
  allowedRoles: readonly (SecondaryRole | AuthenticatedUser["primaryRole"])[],
  message = "You do not have permission to perform this action.",
  request?: Request
): Promise<
  | { user: AuthenticatedUser; response?: never }
  | { user?: never; response: Response }
> {
  const authenticated = await requireAuthenticatedUser(request);
  if (authenticated.response) return authenticated;

  const { user } = authenticated;
  const hasRole = allowedRoles.some(
    (role) =>
      user.primaryRole === role ||
      user.secondaryRoles.some((assignedRole) => assignedRole.role === role)
  );

  if (hasRole) return authenticated;

  return {
    response: Response.json(
      { success: false, message },
      { status: 403 }
    ),
  };
}

/** Requires both an allowed role and university membership for that same user. */
export async function requireUniversityRoles(
  allowedRoles: readonly (SecondaryRole | AuthenticatedUser["primaryRole"])[],
  message = "You do not have permission to perform this action.",
  request?: Request
): Promise<AuthorizationResult<UniversityAuthenticatedUser>> {
  const authorized = await requireRoles(allowedRoles, message, request);
  if (authorized.response) return authorized;

  const { user } = authorized;
  if (!user.universityId) {
    return {
      response: Response.json(
        { success: false, message: "University membership is required." },
        { status: 403 }
      ),
    };
  }

  return { user: user as UniversityAuthenticatedUser };
}

/**
 * Use this filter with opportunity reads/updates to keep both the opportunity
 * and its submitter inside the authenticated user's university.
 */
export function opportunityUniversityScope(
  user: UniversityAuthenticatedUser
): Prisma.OpportunityWhereInput {
  return {
    universityId: user.universityId,
    submitter: { is: { universityId: user.universityId } },
  };
}
