-- CreateEnum
CREATE TYPE "WhatsAppFlowStep" AS ENUM ('IDLE', 'MENU', 'WAITING_FOR_AMOUNT', 'WAITING_FOR_QUOTE_CONFIRMATION', 'WAITING_FOR_FULL_NAME', 'WAITING_FOR_DOCUMENT_NUMBER', 'WAITING_FOR_EMAIL', 'WAITING_FOR_BTC_ADDRESS', 'WAITING_FOR_PAYMENT_CONFIRMATION', 'WAITING_FOR_REFERENCE', 'PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WhatsAppConversationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" "WhatsAppConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_step" "WhatsAppFlowStep" NOT NULL DEFAULT 'IDLE',
    "conversion_session_id" TEXT,
    "quote_id" TEXT,
    "metadata" JSONB,
    "last_inbound_at" TIMESTAMP(3) NOT NULL,
    "last_outbound_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_message_events" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "twilio_message_sid" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_message_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversations_conversion_session_id_key" ON "whatsapp_conversations"("conversion_session_id");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_phone_number_status_idx" ON "whatsapp_conversations"("phone_number", "status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_message_events_twilio_message_sid_key" ON "whatsapp_message_events"("twilio_message_sid");

-- CreateIndex
CREATE INDEX "whatsapp_message_events_conversation_id_idx" ON "whatsapp_message_events"("conversation_id");

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_conversion_session_id_fkey" FOREIGN KEY ("conversion_session_id") REFERENCES "conversion_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_events" ADD CONSTRAINT "whatsapp_message_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
