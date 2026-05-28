-- AlterTable
ALTER TABLE "ProductGroup" ADD COLUMN IF NOT EXISTS "facturaSobreMercancia" BOOLEAN NOT NULL DEFAULT false;
