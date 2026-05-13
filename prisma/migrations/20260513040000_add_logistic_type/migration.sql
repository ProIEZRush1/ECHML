-- AlterTable - add logisticType if not exists
ALTER TABLE "MLOrder" ADD COLUMN IF NOT EXISTS "logisticType" TEXT;
