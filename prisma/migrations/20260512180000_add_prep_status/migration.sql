-- CreateEnum
CREATE TYPE "PrepStatus" AS ENUM ('NEW', 'PREPARING', 'READY', 'SHIPPED');

-- AlterTable
ALTER TABLE "MLOrder" ADD COLUMN "prepStatus" "PrepStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "MLOrder" ADD COLUMN "logisticType" TEXT;

-- CreateIndex
CREATE INDEX "MLOrder_prepStatus_idx" ON "MLOrder"("prepStatus");
