-- CreateTable
CREATE TABLE IF NOT EXISTS "Factura" (
    "id" TEXT NOT NULL,
    "folio" TEXT,
    "rfcEmisor" TEXT,
    "rfcReceptor" TEXT,
    "fechaEmision" TIMESTAMP(3),
    "subtotal" DECIMAL(10,2),
    "iva" DECIMAL(10,2),
    "total" DECIMAL(10,2) NOT NULL,
    "conceptos" TEXT,
    "pdfData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "productGroupId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Factura_productGroupId_idx" ON "Factura"("productGroupId");
CREATE INDEX IF NOT EXISTS "Factura_fechaEmision_idx" ON "Factura"("fechaEmision");
CREATE INDEX IF NOT EXISTS "Factura_status_idx" ON "Factura"("status");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Factura_productGroupId_fkey') THEN
        ALTER TABLE "Factura" ADD CONSTRAINT "Factura_productGroupId_fkey" FOREIGN KEY ("productGroupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
