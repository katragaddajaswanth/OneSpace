-- Add nullable marker so comment removal preserves the original record.
ALTER TABLE "PostComment" ADD COLUMN "deletedAt" TIMESTAMP(3);
