-- Add nullable marker so discussion removal preserves the original record.
ALTER TABLE "CommunityPost" ADD COLUMN "deletedAt" TIMESTAMP(3);
