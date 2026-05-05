-- AlterTable
ALTER TABLE "Pack" ADD COLUMN     "stockSyncEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "variantLabel" TEXT,
ALTER COLUMN "color" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_variantLabel_idx" ON "ProductVariant"("productId", "variantLabel");
