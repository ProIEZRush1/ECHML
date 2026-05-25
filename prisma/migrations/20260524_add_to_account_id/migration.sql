ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "toAccountId" TEXT;
CREATE INDEX IF NOT EXISTS "Withdrawal_toAccountId_idx" ON "Withdrawal"("toAccountId");

DO $$ BEGIN
  ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_toAccountId_fkey"
    FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
