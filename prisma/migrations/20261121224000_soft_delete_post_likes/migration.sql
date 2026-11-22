-- Add nullable marker so unlike preserves the like record.
ALTER TABLE "PostLike" ADD COLUMN "removedAt" TIMESTAMP(3);
