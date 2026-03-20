-- AlterTable
ALTER TABLE "payout_instructions" ADD COLUMN "external_id" TEXT,
ADD COLUMN "provider_payout_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payout_instructions_external_id_key" ON "payout_instructions"("external_id");
