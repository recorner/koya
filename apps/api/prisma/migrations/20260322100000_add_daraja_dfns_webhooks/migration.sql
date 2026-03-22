-- CreateTable
CREATE TABLE "daraja_requests" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "checkout_request_id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daraja_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dfns_requests" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "dfns_request_id" TEXT,
    "dfns_tx_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dfns_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhooks" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daraja_requests_external_id_key" ON "daraja_requests"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "daraja_requests_checkout_request_id_key" ON "daraja_requests"("checkout_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "dfns_requests_external_id_key" ON "dfns_requests"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "dfns_requests_dfns_request_id_key" ON "dfns_requests"("dfns_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhooks_source_external_id_key" ON "processed_webhooks"("source", "external_id");
