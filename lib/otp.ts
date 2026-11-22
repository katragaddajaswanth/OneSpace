
import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

const OTP_EXPIRY_MINUTES = 5;

type OtpPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

function getOtpSecret(): string {
  const secret = process.env.OTP_SECRET;

  if (!secret || secret.length < 64) {
    throw new Error("OTP_SECRET is missing or invalid");
  }

  return secret;
}

// Generate a cryptographically secure six-digit OTP.
export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

// Hash the OTP using HMAC-SHA256.
export function hashOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string
): string {
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Invalid OTP format");
  }

  return createHmac("sha256", getOtpSecret())
    .update(`${userId}:${purpose}:${code}`)
    .digest("hex");
}

// Verify an OTP without a normal string comparison.
export function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string,
  storedHash: string
): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }

  const expectedHash = Buffer.from(
    hashOtp(userId, purpose, code),
    "hex"
  );

  const actualHash = Buffer.from(storedHash, "hex");

  if (
    actualHash.length !== expectedHash.length ||
    actualHash.length === 0
  ) {
    return false;
  }

  return timingSafeEqual(expectedHash, actualHash);
}

// Calculate OTP expiry time.
export function getOtpExpiry(): Date {
  return new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );
}

