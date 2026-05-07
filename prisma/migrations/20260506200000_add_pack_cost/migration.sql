CREATE TABLE "PackCost" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "PackCost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PackCost_packId_idx" ON "PackCost"("packId");

ALTER TABLE "PackCost" ADD CONSTRAINT "PackCost_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
