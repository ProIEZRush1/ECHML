-- CreateTable
CREATE TABLE "MPTransaction" (
    "id" TEXT NOT NULL,
    "mpId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balanceChange" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "mlOrderId" BIGINT,
    "packId" TEXT,
    "dateCreated" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MPTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MPTransaction_mpId_key" ON "MPTransaction"("mpId");

-- CreateIndex
CREATE INDEX "MPTransaction_dateCreated_idx" ON "MPTransaction"("dateCreated");

-- CreateIndex
CREATE INDEX "MPTransaction_label_idx" ON "MPTransaction"("label");

-- CreateIndex
CREATE INDEX "MPTransaction_packId_idx" ON "MPTransaction"("packId");

-- AddForeignKey
ALTER TABLE "MPTransaction" ADD CONSTRAINT "MPTransaction_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
