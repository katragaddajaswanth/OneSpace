
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { randomBytes, createHash } from "crypto";

const SESSION_DURATION_DAYS = 7;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return Response.json(
        { success: false, message: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (
      !user ||
      !user.passwordHash ||
      user.accountStatus !== "ACTIVE" ||
      !user.emailVerified
    ) {
      return Response.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(
      password,
      user.passwordHash
    );

    if (!passwordValid) {
      return Response.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const sessionToken = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(sessionToken)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
    );

    await prisma.$transaction(async (tx) => {
      await tx.userSession.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      await tx.authAuditLog.create({
        data: {
          userId: user.id,
          event: "LOGIN_SUCCESS",
        },
      });
    });

    const response = Response.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        primaryRole: user.primaryRole,
      },
    });

    response.headers.append(
      "Set-Cookie",
      `one_space_session=${sessionToken}; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION_DAYS * 24 * 60 * 60}`
    );

    return response;
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return Response.json(
      { success: false, message: "Login could not be completed." },
      { status: 500 }
    );
  }
}
