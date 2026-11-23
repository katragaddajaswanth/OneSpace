import "server-only";

import type { SecondaryRole } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { isReadOnlyDemoUser } from "@/lib/demo-protection";
import { getAuthenticatedSession } from "@/lib/auth-session";

const SESSION_COOKIE_NAME = "one_space_session";

import { AuthenticatedUser as SessionAuthenticatedUser } from "@/lib/auth-session";

export type AuthenticatedUser = SessionAuthenticatedUser;

export type UniversityAuthenticatedUser = AuthenticatedUser & {
  universityId: string;
};

export type AuthorizationResult<TUser> =
  | { user: TUser; response?: never }
  | { user?: never; response: Response };

export { getAuthenticatedSession };

export async function getAuthenticatedUser(
  request?: Request,
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
        { status: 401 },
      ),
    };
  }

  return { user: session.user };
}

/** Requires a valid session and university membership from the database user. */
export async function requireUniversityUser(
  request?: Request,
): Promise<AuthorizationResult<UniversityAuthenticatedUser>> {
  const authenticated = await requireAuthenticatedUser(request);
  if (authenticated.response) return authenticated;

  const { user } = authenticated;
  if (!user.universityId) {
    return {
      response: Response.json({ success: false, message: "University membership is required." }, { status: 403 }),
    };
  }

  return { user: user as UniversityAuthenticatedUser };
}

/** Authenticates from the session cookie, then returns HTTP 403 if no role matches. */
export async function requireRoles(
  allowedRoles: readonly (SecondaryRole | AuthenticatedUser["primaryRole"])[],
  message = "You do not have permission to perform this action.",
  request?: Request,
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
      user.secondaryRoles.some((assignedRole) => assignedRole.role === role),
  );

  if (hasRole) return authenticated;

  return {
    response: Response.json({ success: false, message }, { status: 403 }),
  };
}

/** Requires both an allowed role and university membership for that same user. */
export async function requireUniversityRoles(
  allowedRoles: readonly (SecondaryRole | AuthenticatedUser["primaryRole"])[],
  message = "You do not have permission to perform this action.",
  request?: Request,
): Promise<AuthorizationResult<UniversityAuthenticatedUser>> {
  const authorized = await requireRoles(allowedRoles, message, request);
  if (authorized.response) return authorized;

  const { user } = authorized;
  if (!user.universityId) {
    return {
      response: Response.json({ success: false, message: "University membership is required." }, { status: 403 }),
    };
  }

  return { user: user as UniversityAuthenticatedUser };
}

/**
 * Use this filter with opportunity reads/updates to keep both the opportunity
 * and its submitter inside the authenticated user's university.
 */
export function opportunityUniversityScope(
  user: UniversityAuthenticatedUser,
): Prisma.OpportunityWhereInput {
  return {
    universityId: user.universityId,
    submitter: { is: { universityId: user.universityId } },
  };
}

export function isDemoUniversityUser(user: AuthenticatedUser): boolean {
  return isReadOnlyDemoUser(user);
}

export async function requireWritableUniversity(
  request?: Request,
): Promise<AuthorizationResult<UniversityAuthenticatedUser>> {
  const authorized = await requireUniversityUser(request);
  if (authorized.response) return authorized;

  if (isDemoUniversityUser(authorized.user)) {
    return {
      response: Response.json(
        {
          success: false,
          message: "This is a read-only demonstration account.",
          code: "DEMO_READ_ONLY",
        },
        { status: 403, headers: { "Cache-Control": "private, no-store" } },
      ),
    };
  }

  return authorized;
}

export async function requireWritableUniversityRoles(
  allowedRoles: readonly (SecondaryRole | AuthenticatedUser["primaryRole"])[],
  message = "You do not have permission to perform this action.",
  request?: Request,
): Promise<AuthorizationResult<UniversityAuthenticatedUser>> {
  const authorized = await requireWritableUniversity(request);
  if (authorized.response) return authorized;

  const { user } = authorized;
  const hasRole = allowedRoles.some(
    (role) =>
      user.primaryRole === role ||
      user.secondaryRoles.some((assignedRole) => assignedRole.role === role),
  );

  if (!hasRole) {
    return {
      response: Response.json({ success: false, message }, { status: 403, headers: { "Cache-Control": "private, no-store" } }),
    };
  }

  return authorized;
}
