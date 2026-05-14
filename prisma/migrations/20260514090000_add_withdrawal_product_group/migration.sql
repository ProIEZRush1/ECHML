-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "productGroupId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Withdrawal_productGroupId_idx" ON "Withdrawal"("productGroupId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_productGroupId_fkey" FOREIGN KEY ("productGroupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
