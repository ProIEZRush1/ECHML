-- Marca el origen de cada transaccion: 'ml' (sincronizado de MercadoLibre/MP) o 'manual' (venta fuera de ML)
ALTER TABLE "MPTransaction" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'ml';
CREATE INDEX IF NOT EXISTS "MPTransaction_source_idx" ON "MPTransaction"("source");
