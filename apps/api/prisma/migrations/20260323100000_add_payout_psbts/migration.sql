-- CreateTable
CREATE TABLE "payout_psbts" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "psbt_base64" TEXT NOT NULL,
    "psbt_status" TEXT NOT NULL DEFAULT 'unsigned',
    "psbt_id" TEXT,
    "dfns_request_id" TEXT,
    "signed_psbt_base64" TEXT,
    "txid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_psbts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_psbts_external_id_key" ON "payout_psbts"("external_id");
