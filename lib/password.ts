
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;
const MAX_PASSWORD_BYTES = 72;

export async function hashPassword(password: string): Promise<string> {
  const passwordBytes = Buffer.byteLength(password, "utf8");

  if (passwordBytes < 12 || passwordBytes > MAX_PASSWORD_BYTES) {
    throw new Error(
      "Password must be at least 12 characters and no more than 72 bytes"
    );
  }

  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  if (
    Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES
  ) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}
