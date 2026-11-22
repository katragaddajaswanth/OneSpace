import "dotenv/config";
import bcrypt from "bcryptjs";

const email = "alumni.test@one-space.local";
const saltRounds = 12;

if (process.env.NODE_ENV !== "development") {
  console.error("Refusing to change the test password unless NODE_ENV is development.");
  process.exit(1);
}

if (process.env.ONE_SPACE_DATABASE_ENV !== "development") {
  console.error("Refusing to change the test password without ONE_SPACE_DATABASE_ENV=development.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
const password = process.env.ONE_SPACE_ALUMNI_TEST_PASSWORD;
delete process.env.ONE_SPACE_ALUMNI_TEST_PASSWORD;

if (!connectionString) {
  console.error("Development database is not configured.");
  process.exit(1);
}

if (!password || Buffer.byteLength(password, "utf8") > 72) {
  console.error("Provide a development test password no longer than 72 bytes.");
  process.exit(1);
}

const [{ PrismaClient }, { PrismaNeon }] = await Promise.all([
  import("../generated/prisma/client"),
  import("@prisma/adapter-neon"),
]);
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const universities = await prisma.university.findMany({
    select: { id: true, name: true, slug: true, isActive: true },
    take: 50,
  });
  const activeUniversities = universities.filter((university) => university.isActive);
  const namedDevelopmentUniversities = activeUniversities.filter(
    (university) => /development/i.test(`${university.name} ${university.slug}`)
  );
  const developmentUniversity = namedDevelopmentUniversities.length === 1
    ? namedDevelopmentUniversities[0]
    : namedDevelopmentUniversities.length === 0 &&
        activeUniversities.length === 1 &&
        activeUniversities[0].slug === "demo-university"
      ? activeUniversities[0]
      : null;

  if (!developmentUniversity) {
    console.error("Could not confirm the development university; no account changes were made.");
    process.exitCode = 1;
  } else {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        primaryRole: true,
        universityId: true,
        accountStatus: true,
        emailVerified: true,
      },
    });

    if (
      !user ||
      user.primaryRole !== "ALUMNI" ||
      user.universityId !== developmentUniversity.id ||
      user.accountStatus !== "ACTIVE" ||
      !user.emailVerified
    ) {
      console.error("The expected active Alumni development account was not found; no account changes were made.");
      process.exitCode = 1;
    } else {
      // Match the app's bcryptjs algorithm and 12-round cost. This one local test
      // password is below registration's minimum; no auth or registration rule changes.
      const passwordHash = await bcrypt.hash(password, saltRounds);
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash },
        });
        await tx.userSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.authAuditLog.create({
          data: {
            userId: user.id,
            event: "PASSWORD_CHANGED",
            details: { source: "development_test_account_password_update" },
          },
        });
      });

      console.log("Alumni test account password updated; the password was not printed or logged.");
      console.log(`Login email: ${email}`);
      console.log(`University: ${developmentUniversity.name}`);
      console.log("Login URL: http://localhost:3000/login");
      console.log("Existing sessions for this account were revoked.");
    }
  }
} catch {
  console.error("Alumni test password update failed; no credentials were logged.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
