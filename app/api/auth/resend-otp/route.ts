
import { prisma } from "@/lib/prisma";
import { createAndSendOtp } from "@/lib/otp-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return Response.json(
        { success: false, message: "Email is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.emailVerified ||
        user.accountStatus !== "PENDING_VERIFICATION") {
      return Response.json(
        { success: false, message: "Unable to resend verification OTP." },
        { status: 400 }
      );
    }
    if (user.isDemoAccount) {
      return Response.json(
        { success: false, message: "OTP resend is unavailable for read-only demonstration accounts." },
        { status: 403 }
      );
    }

    const challenge = await prisma.emailOtpChallenge.findFirst({
      where: {
        userId: user.id,
        purpose: "EMAIL_VERIFICATION",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge) {
      return Response.json(
        { success: false, message: "No verification request found." },
        { status: 400 }
      );
    }

    await createAndSendOtp(
      user.id,
      challenge.email,
      "EMAIL_VERIFICATION"
    );

    return Response.json({
      success: true,
      message: "A new verification OTP has been sent.",
    });
  } catch (error) {
    console.error("RESEND OTP ERROR:", error);

    return Response.json(
      {
        success: false,
        message: "Could not resend OTP. Please try again later.",
      },
      { status: 400 }
    );
  }
}
