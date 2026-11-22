import "dotenv/config";
import bcrypt from "bcryptjs";

const email = "admin.test@one-space.local";
const fullName = "ONE-SPACE Administrator Tester";
const saltRounds = 12;

if (process.env.NODE_ENV !== "development") {
  console.error("Refusing to create the test account unless NODE_ENV is development.");
  process.exit(1);
}

if (process.env.ONE_SPACE_DATABASE_ENV !== "development") {
  console.error("Refusing to create the test account without ONE_SPACE_DATABASE_ENV=development.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
const password = process.env.ONE_SPACE_ADMIN_TEST_PASSWORD;
delete process.env.ONE_SPACE_ADMIN_TEST_PASSWORD;

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
    console.error("Could not identify exactly one active Development university; no account changes were made.");
    process.exitCode = 1;
  } else {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        primaryRole: true,
        universityId: true,
        accountStatus: true,
        emailVerified: true,
        secondaryRoles: { select: { role: true } },
      },
    });

    if (existing) {
      const isAdministrator = existing.secondaryRoles.some(
        (assignment) => assignment.role === "ADMINISTRATOR"
      );
      if (!isAdministrator) {
        console.error("The requested test email already belongs to a non-Administrator account; no changes were made.");
        process.exitCode = 1;
      } else {
        console.log("Administrator test account already exists; no account or password changes were made.");
        console.log(`Login email: ${email}`);
        console.log(`University: ${developmentUniversity.name}`);
      }
    } else {
      // Mirror lib/password.ts bcryptjs hashing and 12-round cost. The supplied
      // development-only password is below that helper's registration minimum;
      // runtime authentication and registration policy are left unchanged.
      const passwordHash = await bcrypt.hash(password, saltRounds);

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName,
            email,
            passwordHash,
            primaryRole: "FACULTY",
            universityId: developmentUniversity.id,
            accountStatus: "ACTIVE",
            emailVerified: true,
          },
          select: { id: true },
        });
        await tx.userRole.create({
          data: { userId: user.id, role: "ADMINISTRATOR" },
        });
      });

      console.log("Administrator test account created.");
      console.log(`Login email: ${email}`);
      console.log(`University: ${developmentUniversity.name}`);
      console.log("Primary role: FACULTY");
      console.log("Secondary role: ADMINISTRATOR");
      console.log("Account status: ACTIVE; email verified");
      console.log("Login URL: http://localhost:3000/login");
    }
  }
} catch {
  console.error("Administrator test account setup failed; no credentials were logged.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
