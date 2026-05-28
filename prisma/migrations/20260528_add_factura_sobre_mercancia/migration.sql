-- AlterTable
ALTER TABLE "ProductGroup" ADD COLUMN IF NOT EXISTS "facturaSobreMercancia" BOOLEAN NOT NULL DEFAULT false;
# Redeploy trigger 1779942704
