import "dotenv/config";
import { randomBytes } from "node:crypto";

const email = "alumni.test@one-space.local";

if (process.env.NODE_ENV !== "development") {
  console.error("Refusing to create the test account unless NODE_ENV is development.");
  process.exit(1);
}

if (process.env.ONE_SPACE_DATABASE_ENV !== "development") {
  console.error("Refusing to create the test account without ONE_SPACE_DATABASE_ENV=development.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Development database is not configured.");
  process.exit(1);
}

const [{ PrismaClient }, { PrismaNeon }, { hashPassword }] = await Promise.all([
  import("../generated/prisma/client"),
  import("@prisma/adapter-neon"),
  import("../lib/password"),
]);

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

let stage = "look up Development university";
try {
  const developmentUniversities = await prisma.university.findMany({
    select: { id: true, name: true, slug: true, isActive: true },
    take: 50,
  });
  const activeUniversities = developmentUniversities.filter(
    (university) => university.isActive
  );
  const namedDevelopmentUniversities = activeUniversities.filter(
    (university) => university.isActive && /development/i.test(`${university.name} ${university.slug}`)
  );
  const developmentUniversity = namedDevelopmentUniversities.length === 1
    ? namedDevelopmentUniversities[0]
    : namedDevelopmentUniversities.length === 0 &&
        activeUniversities.length === 1 &&
        activeUniversities[0].slug === "demo-university"
      ? activeUniversities[0]
      : null;

  if (!developmentUniversity) {
    const candidates = developmentUniversities.length
      ? developmentUniversities
          .map(({ name, slug, isActive }) => `${name} (${slug}, ${isActive ? "active" : "inactive"})`)
          .join("; ")
      : "none found";
    console.error(`Could not identify one active Development university. Existing universities: ${candidates}. No account changes were made.`);
    process.exitCode = 1;
  } else {
    const universityId = developmentUniversity.id;
    stage = "look up Alumni test account";
    const currentUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    let generatedPassword: string | null = null;
    let created = false;
    const passwordHash = currentUser?.passwordHash ?? await (async () => {
      stage = "hash development password";
      generatedPassword = randomBytes(24).toString("base64url");
      return hashPassword(generatedPassword);
    })();

    if (currentUser) {
      stage = "update development account attributes";
      await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          fullName: "ONE-SPACE Alumni Tester",
          primaryRole: "ALUMNI",
          universityId,
          accountStatus: "ACTIVE",
          emailVerified: true,
          ...(currentUser.passwordHash ? {} : { passwordHash }),
        },
      });
    } else {
      stage = "create development account";
      await prisma.user.create({
        data: {
          fullName: "ONE-SPACE Alumni Tester",
          email,
          passwordHash,
          primaryRole: "ALUMNI",
          universityId,
          accountStatus: "ACTIVE",
          emailVerified: true,
        },
      });
      created = true;
    }

    console.log(`Alumni test account ${created ? "created" : "verified"}.`);
    console.log(`University: ${developmentUniversity.name}`);
    console.log(`Login email: ${email}`);
    if (generatedPassword) {
      console.log(`Generated password (shown once): ${generatedPassword}`);
      console.log("Store this password securely; it will not be shown again.");
    } else {
      console.log("An existing password was preserved and was not displayed.");
    }
    console.log("Login URL: http://localhost:3000/login");
  }
} catch (error) {
  const safeError = error as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown };
  const errorName = typeof safeError.name === "string" ? safeError.name : "Error";
  const errorCode = typeof safeError.code === "string" ? ` (${safeError.code})` : "";
  const safeMessage = typeof safeError.message === "string" && safeError.message.length > 0
    ? safeError.message
        .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"'`<>]+/gi, "[redacted-url]")
        .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, "[redacted-email]")
        .replace(/\b(password|token|secret|database_url|connectionstring)\b(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[redacted]")
        .replace(/'(?:[^']|'')*'/g, "'[redacted]'")
        .replace(/"(?:[^"]|"")*"/g, '"[redacted]"')
        .replace(/[\r\n\t]+/g, " ")
        .slice(0, 400)
    : "No error message provided.";
  const cause = safeError.cause as { name?: unknown; code?: unknown; message?: unknown } | undefined;
  const causeSummary = cause
    ? ` Cause: ${typeof cause.name === "string" ? cause.name : "Error"}${typeof cause.code === "string" ? ` (${cause.code})` : ""}.`
    : "";
  const propertyNames = error && typeof error === "object"
    ? Object.getOwnPropertyNames(error).filter((key) => /^[A-Za-z]+$/.test(key)).join(",")
    : "none";
  const constructorName = error && typeof error === "object"
    ? Object.getPrototypeOf(error)?.constructor?.name
    : undefined;
  console.error(`Alumni test account setup failed during ${stage}: ${errorName}${errorCode}${typeof constructorName === "string" ? ` [${constructorName}]` : ""}: ${safeMessage}.${causeSummary} Error properties: ${propertyNames}. No credentials were logged.`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
