
import { PrismaClient } from "../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { getOrCreateCompatiblePrismaClient } from "@/lib/prisma-client-compatibility";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaNeon({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const cachedPrisma = globalForPrisma.prisma;

// In development, a global client can outlive Prisma Client regeneration during HMR.
// Reuse it only when it exposes the delegates required by the current generated schema.
export const prisma = getOrCreateCompatiblePrismaClient(
  cachedPrisma,
  () => new PrismaClient({ adapter })
);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
