// Extracted session authentication logic for test mocking.
import { createHash } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

// Exported include used for building the AuthenticatedUser payload type.
export const authenticatedUserInclude = {
  university: { select: { id: true, name: true, slug: true, kind: true, isReadOnlyDemo: true } },
  department: { select: { id: true, name: true, code: true } },
  program: { select: { id: true, name: true, code: true } },
  studentProfile: { select: { admissionYear: true, currentSemester: true, batch: true } },
  facultyProfile: { select: { designation: true, specialization: true, experienceYears: true } },
  secondaryRoles: { select: { role: true } },
} as const;

// AuthenticatedUser derived from the include.
export type AuthenticatedUser = Prisma.UserGetPayload<{ include: typeof authenticatedUserInclude }>;

// Discriminated union for the result of getAuthenticatedSession.
export type AuthenticationResult =
  | { user: AuthenticatedUser; failure?: never }
  | { user?: never; failure: "missing" | "invalid" };

const SESSION_COOKIE_NAME = "one_space_session";

export async function getAuthenticatedSession(request?: Request): Promise<AuthenticationResult> {
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
