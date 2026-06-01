-- Permite ligar una venta manual a una variante específica (producto + color/talla)
ALTER TABLE "MPTransaction" ADD COLUMN IF NOT EXISTS "productVariantId" TEXT;
CREATE INDEX IF NOT EXISTS "MPTransaction_productVariantId_idx" ON "MPTransaction"("productVariantId");
ALTER TABLE "MPTransaction" ADD CONSTRAINT "MPTransaction_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
