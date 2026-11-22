-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('JOB', 'INTERNSHIP', 'REFERRAL', 'FREELANCE', 'COLLABORATION', 'LIVE_PROJECT', 'CHALLENGE', 'RESEARCH');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OpportunitySubmitterRole" AS ENUM ('ALUMNI', 'INDUSTRY_REPRESENTATIVE');

-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('PAID', 'UNPAID', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ON_SITE');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "OpportunityNotificationType" AS ENUM ('OPPORTUNITY_APPROVED', 'OPPORTUNITY_REJECTED', 'APPLICATION_RECEIVED', 'APPLICATION_STATUS_UPDATED', 'NEW_MATCHING_OPPORTUNITY');

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "submitterRole" "OpportunitySubmitterRole" NOT NULL,
    "compensationType" "CompensationType" NOT NULL DEFAULT 'NOT_SPECIFIED',
    "location" TEXT,
    "workMode" "WorkMode" NOT NULL DEFAULT 'REMOTE',
    "eligibility" TEXT NOT NULL,
    "requiredSkills" TEXT,
    "applicationDeadline" TIMESTAMP(3) NOT NULL,
    "applicationUrl" TEXT,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityApproval" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "reason" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityApplication" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "message" TEXT,
    "resumeUrl" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedOpportunity" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityNotification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "type" "OpportunityNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Opportunity_universityId_status_createdAt_idx" ON "Opportunity"("universityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_submittedById_createdAt_idx" ON "Opportunity"("submittedById", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_type_status_idx" ON "Opportunity"("type", "status");

-- CreateIndex
CREATE INDEX "Opportunity_applicationDeadline_idx" ON "Opportunity"("applicationDeadline");

-- CreateIndex
CREATE INDEX "OpportunityApproval_opportunityId_reviewedAt_idx" ON "OpportunityApproval"("opportunityId", "reviewedAt");

-- CreateIndex
CREATE INDEX "OpportunityApproval_reviewerId_reviewedAt_idx" ON "OpportunityApproval"("reviewerId", "reviewedAt");

-- CreateIndex
CREATE INDEX "OpportunityApplication_studentId_appliedAt_idx" ON "OpportunityApplication"("studentId", "appliedAt");

-- CreateIndex
CREATE INDEX "OpportunityApplication_opportunityId_status_idx" ON "OpportunityApplication"("opportunityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityApplication_opportunityId_studentId_key" ON "OpportunityApplication"("opportunityId", "studentId");

-- CreateIndex
CREATE INDEX "SavedOpportunity_studentId_savedAt_idx" ON "SavedOpportunity"("studentId", "savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_opportunityId_studentId_key" ON "SavedOpportunity"("opportunityId", "studentId");

-- CreateIndex
CREATE INDEX "OpportunityNotification_recipientId_readAt_createdAt_idx" ON "OpportunityNotification"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunityNotification_opportunityId_idx" ON "OpportunityNotification"("opportunityId");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApproval" ADD CONSTRAINT "OpportunityApproval_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApproval" ADD CONSTRAINT "OpportunityApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityNotification" ADD CONSTRAINT "OpportunityNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityNotification" ADD CONSTRAINT "OpportunityNotification_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
