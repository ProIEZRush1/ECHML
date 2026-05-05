-- CreateTable
CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductGroupItem" (
    "id" TEXT NOT NULL,
    "productGroupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProductGroupItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductGroup_name_key" ON "ProductGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductGroupItem_productGroupId_productId_key" ON "ProductGroupItem"("productGroupId", "productId");

-- AddForeignKey
ALTER TABLE "ProductGroupItem" ADD CONSTRAINT "ProductGroupItem_productGroupId_fkey" FOREIGN KEY ("productGroupId") REFERENCES "ProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroupItem" ADD CONSTRAINT "ProductGroupItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
