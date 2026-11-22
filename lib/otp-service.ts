
import { prisma } from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";
import {
  generateOtp,
  getOtpExpiry,
  hashOtp,
  verifyOtp,
} from "@/lib/otp";

type OtpPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

const OTP_COOLDOWN_MS = 60 * 1000;

export async function createAndSendOtp(
  userId: string,
  recipientEmail: string,
  purpose: OtpPurpose
) {
  // The recipient must come from trusted server-side data,
  // such as the email returned by the ERP adapter.
  const now = new Date();

  const recentChallenge = await prisma.emailOtpChallenge.findFirst({
    where: {
      userId,
      purpose,
      createdAt: {
        gt: new Date(now.getTime() - OTP_COOLDOWN_MS),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (recentChallenge) {
    throw new Error("Please wait before requesting another OTP");
  }

  const code = generateOtp();
  const codeHash = hashOtp(userId, purpose, code);

  const challenge = await prisma.$transaction(async (tx) => {
    // Invalidate previous unused challenges.
    await tx.emailOtpChallenge.updateMany({
      where: {
        userId,
        purpose,
        consumedAt: null,
        lockedAt: null,
      },
      data: {
        consumedAt: now,
      },
    });

    return tx.emailOtpChallenge.create({
      data: {
        userId,
        email: recipientEmail,
        codeHash,
        purpose,
        expiresAt: getOtpExpiry(),
        maxAttempts: 5,
      },
    });
  });

  try {
    await sendOtpEmail({
      to: recipientEmail,
      code,
      purpose,
    });
  } catch (error) {
    await prisma.emailOtpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    throw error;
  }

  return {
    success: true,
    message: "OTP sent successfully",
  };
}

export async function verifyOtpChallenge(
  userId: string,
  purpose: OtpPurpose,
  code: string
) {
  if (!/^\d{6}$/.test(code)) {
    return { success: false, message: "Invalid or expired OTP" };
  }

  const now = new Date();

  const challenge = await prisma.emailOtpChallenge.findFirst({
    where: {
      userId,
      purpose,
      consumedAt: null,
      lockedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: 5 },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!challenge) {
    return { success: false, message: "Invalid or expired OTP" };
  }

  const isValid = verifyOtp(
    userId,
    purpose,
    code,
    challenge.codeHash
  );

  if (!isValid) {
    const nextAttempts = challenge.attempts + 1;

    const result = await prisma.emailOtpChallenge.updateMany({
      where: {
        id: challenge.id,
        attempts: challenge.attempts,
        consumedAt: null,
        lockedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        attempts: { increment: 1 },
        ...(nextAttempts >= challenge.maxAttempts
          ? { lockedAt: now }
          : {}),
      },
    });

    if (result.count !== 1) {
      return { success: false, message: "Invalid or expired OTP" };
    }

    return {
      success: false,
      message:
        nextAttempts >= challenge.maxAttempts
          ? "Too many attempts. Request a new OTP."
          : "Invalid or expired OTP",
    };
  }

  // Atomic one-time consumption. Only one concurrent request
  // can successfully consume this challenge.
  const consumed = await prisma.emailOtpChallenge.updateMany({
    where: {
      id: challenge.id,
      attempts: challenge.attempts,
      consumedAt: null,
      lockedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      consumedAt: now,
    },
  });

  if (consumed.count !== 1) {
    return { success: false, message: "Invalid or expired OTP" };
  }

  return {
    success: true,
    message: "OTP verified successfully",
  };
}
