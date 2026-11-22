
import { prisma } from "@/lib/prisma";
import { verifyOtpChallenge } from "@/lib/otp-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    const code =
      typeof body.code === "string" ? body.code.trim() : "";

    if (!email || !/^\d{6}$/.test(code)) {
      return Response.json(
        {
          success: false,
          message: "Valid email and six-digit OTP are required.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.accountStatus !== "PENDING_VERIFICATION") {
      return Response.json(
        {
          success: false,
          message: "Invalid or unavailable verification request.",
        },
        { status: 400 }
      );
    }

    const verification = await verifyOtpChallenge(
      user.id,
      "EMAIL_VERIFICATION",
      code
    );

    if (!verification.success) {
      return Response.json(
        {
          success: false,
          message: verification.message,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          accountStatus: "ACTIVE",
        },
      });

      await tx.authAuditLog.create({
        data: {
          userId: user.id,
          event: "EMAIL_VERIFIED",
        },
      });
    });

    return Response.json({
      success: true,
      message: "Email verified. Your One-Space account is now active.",
    });
  } catch (error) {
    console.error("OTP VERIFICATION ERROR:", error);

    return Response.json(
      {
        success: false,
        message: "Verification could not be completed.",
      },
      { status: 500 }
    );
  }
}
