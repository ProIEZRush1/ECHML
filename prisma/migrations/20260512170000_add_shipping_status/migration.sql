-- CreateEnum
CREATE TYPE "ShippingStatus" AS ENUM ('PENDING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'NOT_DELIVERED', 'RETURNED', 'CANCELLED');

-- AlterTable
ALTER TABLE "MLOrder" ADD COLUMN "shippingStatus" "ShippingStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "MLOrder" ADD COLUMN "shipmentId" BIGINT;

-- CreateIndex
CREATE INDEX "MLOrder_shippingStatus_idx" ON "MLOrder"("shippingStatus");
