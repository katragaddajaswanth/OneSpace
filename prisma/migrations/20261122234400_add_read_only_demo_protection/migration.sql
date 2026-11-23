-- CreateEnum
CREATE TYPE "UniversityKind" AS ENUM ('REAL', 'DEMO');

-- AlterTable
ALTER TABLE "University"
ADD COLUMN "kind" "UniversityKind" NOT NULL DEFAULT 'REAL',
ADD COLUMN "isReadOnlyDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "isDemoAccount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "demoSeedKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_demoSeedKey_key" ON "User"("demoSeedKey");
