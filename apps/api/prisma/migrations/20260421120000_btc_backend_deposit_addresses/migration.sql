-- Add payout dispatch retry state for graceful degraded mode.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PayoutInstructionStatus'
      AND e.enumlabel = 'PENDING_DISPATCH'
  ) THEN
    ALTER TYPE "PayoutInstructionStatus" ADD VALUE 'PENDING_DISPATCH';
  END IF;
END$$;

ALTER TABLE "payout_instructions"
  ADD COLUMN IF NOT EXISTS "dispatch_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "next_dispatch_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_dispatch_error" TEXT;

CREATE INDEX IF NOT EXISTS "payout_instructions_dispatch_idx"
  ON "payout_instructions"("status", "next_dispatch_at");

-- Persist generated BTC deposit addresses with business context linkage.
CREATE TABLE IF NOT EXISTS "btc_deposit_addresses" (
  "id" TEXT NOT NULL,
  "backend" TEXT NOT NULL,
  "btc_network" TEXT NOT NULL,
  "wallet_name" TEXT,
  "address" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "business_context_type" TEXT NOT NULL,
  "business_context_ref" TEXT NOT NULL,
  "conversion_session_id" TEXT,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "btc_deposit_addresses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "btc_deposit_addresses_address_key"
  ON "btc_deposit_addresses"("address");

CREATE UNIQUE INDEX IF NOT EXISTS "btc_deposit_addresses_external_id_key"
  ON "btc_deposit_addresses"("external_id");

CREATE INDEX IF NOT EXISTS "btc_deposit_addresses_context_idx"
  ON "btc_deposit_addresses"("business_context_type", "business_context_ref");

CREATE INDEX IF NOT EXISTS "btc_deposit_addresses_session_idx"
  ON "btc_deposit_addresses"("conversion_session_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'btc_deposit_addresses_conversion_session_id_fkey'
  ) THEN
    ALTER TABLE "btc_deposit_addresses"
      ADD CONSTRAINT "btc_deposit_addresses_conversion_session_id_fkey"
      FOREIGN KEY ("conversion_session_id") REFERENCES "conversion_sessions"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
