-- CreateTable: Account
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AccountTransfer
CREATE TABLE IF NOT EXISTS "AccountTransfer" (
    "id" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "concept" TEXT NOT NULL,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Account_name_key" ON "Account"("name");
CREATE INDEX IF NOT EXISTS "AccountTransfer_date_idx" ON "AccountTransfer"("date");
CREATE INDEX IF NOT EXISTS "AccountTransfer_fromAccountId_idx" ON "AccountTransfer"("fromAccountId");
CREATE INDEX IF NOT EXISTS "AccountTransfer_toAccountId_idx" ON "AccountTransfer"("toAccountId");

-- AlterTable: Expense - add accountId
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
CREATE INDEX IF NOT EXISTS "Expense_accountId_idx" ON "Expense"("accountId");

-- AlterTable: Withdrawal - add accountId
ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
CREATE INDEX IF NOT EXISTS "Withdrawal_accountId_idx" ON "Withdrawal"("accountId");

-- AddForeignKeys
DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_fromAccountId_fkey"
    FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_toAccountId_fkey"
    FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
