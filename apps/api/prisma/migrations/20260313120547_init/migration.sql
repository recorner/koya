-- CreateEnum
CREATE TYPE "ConversionState" AS ENUM ('INTENT_CAPTURED', 'QUOTE_PENDING', 'QUOTE_READY', 'QUOTE_CONFIRMED', 'IDENTITY_PENDING', 'COMPLIANCE_PENDING', 'PAYOUT_DETAILS_PENDING', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'EXECUTION_PENDING', 'DELIVERY_PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WEB', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "GuestStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'READY', 'CONFIRMED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentInstructionStatus" AS ENUM ('CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutInstructionStatus" AS ENUM ('CREATED', 'PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'ALIEN_ID', 'MILITARY_ID');

-- CreateTable
CREATE TABLE "guest_profiles" (
    "id" TEXT NOT NULL,
    "guest_ref" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "document_number_normalized" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "email" TEXT,
    "status" "GuestStatus" NOT NULL DEFAULT 'ACTIVE',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_sessions" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "guest_profile_id" TEXT,
    "current_state" "ConversionState" NOT NULL DEFAULT 'INTENT_CAPTURED',
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "source_asset" TEXT NOT NULL,
    "target_asset" TEXT NOT NULL,
    "source_amount_minor" BIGINT NOT NULL,
    "quoted_target_amount_minor" BIGINT,
    "quote_id" TEXT,
    "route_policy_key" TEXT NOT NULL,
    "payin_method" TEXT NOT NULL,
    "payout_method" TEXT NOT NULL,
    "reference_code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversion_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_quotes" (
    "id" TEXT NOT NULL,
    "source_asset" TEXT NOT NULL,
    "target_asset" TEXT NOT NULL,
    "source_amount_minor" BIGINT NOT NULL,
    "target_amount_minor" BIGINT NOT NULL,
    "rate" DECIMAL(30,18) NOT NULL,
    "spread" DECIMAL(10,6) NOT NULL,
    "fee_minor" BIGINT NOT NULL,
    "fee_currency" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversion_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_instructions" (
    "id" TEXT NOT NULL,
    "conversion_session_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MPESA',
    "instruction_type" TEXT NOT NULL DEFAULT 'STK_PUSH',
    "phone_e164" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "external_reference" TEXT,
    "merchant_request_id" TEXT,
    "checkout_request_id" TEXT,
    "status" "PaymentInstructionStatus" NOT NULL DEFAULT 'CREATED',
    "raw_callback_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_instructions" (
    "id" TEXT NOT NULL,
    "conversion_session_id" TEXT NOT NULL,
    "destination_type" TEXT NOT NULL DEFAULT 'BTC_ADDRESS',
    "btc_address" TEXT NOT NULL,
    "amount_minor" BIGINT,
    "tx_hash" TEXT,
    "status" "PayoutInstructionStatus" NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_state_events" (
    "id" TEXT NOT NULL,
    "conversion_session_id" TEXT NOT NULL,
    "from_state" "ConversionState",
    "to_state" "ConversionState" NOT NULL,
    "trigger" TEXT NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_state_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_profiles_guest_ref_key" ON "guest_profiles"("guest_ref");

-- CreateIndex
CREATE UNIQUE INDEX "guest_profiles_country_code_document_type_document_number_n_key" ON "guest_profiles"("country_code", "document_type", "document_number_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "conversion_sessions_reference_code_key" ON "conversion_sessions"("reference_code");

-- CreateIndex
CREATE INDEX "conversion_sessions_guest_profile_id_idx" ON "conversion_sessions"("guest_profile_id");

-- CreateIndex
CREATE INDEX "conversion_sessions_reference_code_idx" ON "conversion_sessions"("reference_code");

-- CreateIndex
CREATE UNIQUE INDEX "payment_instructions_conversion_session_id_key" ON "payment_instructions"("conversion_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_instructions_checkout_request_id_key" ON "payment_instructions"("checkout_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_instructions_conversion_session_id_key" ON "payout_instructions"("conversion_session_id");

-- CreateIndex
CREATE INDEX "conversion_state_events_conversion_session_id_idx" ON "conversion_state_events"("conversion_session_id");

-- AddForeignKey
ALTER TABLE "conversion_sessions" ADD CONSTRAINT "conversion_sessions_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "guest_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_sessions" ADD CONSTRAINT "conversion_sessions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "conversion_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_instructions" ADD CONSTRAINT "payment_instructions_conversion_session_id_fkey" FOREIGN KEY ("conversion_session_id") REFERENCES "conversion_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_instructions" ADD CONSTRAINT "payout_instructions_conversion_session_id_fkey" FOREIGN KEY ("conversion_session_id") REFERENCES "conversion_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_state_events" ADD CONSTRAINT "conversion_state_events_conversion_session_id_fkey" FOREIGN KEY ("conversion_session_id") REFERENCES "conversion_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
