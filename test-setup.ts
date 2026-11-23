// Vitest global setup – provide a dummy DATABASE_URL so lib/prisma does not throw.
process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/fake-db";
