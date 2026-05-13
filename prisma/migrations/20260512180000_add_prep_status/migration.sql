-- CreateEnum
CREATE TYPE "PrepStatus" AS ENUM ('NEW', 'PREPARING', 'READY', 'SHIPPED');

-- AlterTable
ALTER TABLE "MLOrder" ADD COLUMN "prepStatus" "PrepStatus" NOT NULL DEFAULT 'NEW';

-- CreateIndex
CREATE INDEX "MLOrder_prepStatus_idx" ON "MLOrder"("prepStatus");
