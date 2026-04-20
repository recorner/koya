-- Enums
ALTER TYPE "Channel" ADD VALUE IF NOT EXISTS 'TELEGRAM';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessagingProvider') THEN
    CREATE TYPE "MessagingProvider" AS ENUM ('WHATSAPP_CLOUD', 'TELEGRAM');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessagingEventType') THEN
    CREATE TYPE "MessagingEventType" AS ENUM ('INBOUND_MESSAGE', 'PROVIDER_STATUS', 'SYSTEM');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessagingEventStatus') THEN
    CREATE TYPE "MessagingEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'DEAD_LETTER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessagingDeliveryState') THEN
    CREATE TYPE "MessagingDeliveryState" AS ENUM ('SENT', 'FAILED', 'RETRYING', 'DEAD_LETTER');
  END IF;
END $$;

-- Existing WhatsApp tables
ALTER TABLE "whatsapp_conversations"
  ADD COLUMN IF NOT EXISTS "provider" "MessagingProvider" NOT NULL DEFAULT 'WHATSAPP_CLOUD';

DROP INDEX IF EXISTS "whatsapp_conversations_phone_number_status_idx";
CREATE INDEX IF NOT EXISTS "whatsapp_conversations_provider_phone_number_status_idx"
  ON "whatsapp_conversations"("provider", "phone_number", "status");

ALTER TABLE "whatsapp_message_events"
  ADD COLUMN IF NOT EXISTS "provider" "MessagingProvider" NOT NULL DEFAULT 'WHATSAPP_CLOUD';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'whatsapp_message_events'
      AND column_name = 'twilio_message_sid'
  ) THEN
    ALTER TABLE "whatsapp_message_events"
      RENAME COLUMN "twilio_message_sid" TO "provider_message_id";
  END IF;
END $$;

DROP INDEX IF EXISTS "whatsapp_message_events_twilio_message_sid_key";
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_message_events_provider_message_id_key"
  ON "whatsapp_message_events"("provider_message_id");

-- New provider-neutral messaging tables
CREATE TABLE IF NOT EXISTS "messaging_events" (
  "id" TEXT NOT NULL,
  "provider" "MessagingProvider" NOT NULL,
  "provider_account_id" TEXT,
  "provider_event_id" TEXT NOT NULL,
  "provider_message_id" TEXT,
  "conversation_external_id" TEXT NOT NULL,
  "sender_external_id" TEXT NOT NULL,
  "event_type" "MessagingEventType" NOT NULL,
  "event_status" "MessagingEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "checksum" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "correlation_id" TEXT,
  "causation_id" TEXT,
  "payload_json" JSONB NOT NULL,
  "raw_payload_ref" TEXT NOT NULL,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "next_retry_at" TIMESTAMP(3),
  "last_error_type" TEXT,
  "last_error_message" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messaging_delivery_attempts" (
  "id" TEXT NOT NULL,
  "messaging_event_id" TEXT NOT NULL,
  "provider" "MessagingProvider" NOT NULL,
  "conversation_id" TEXT,
  "correlation_id" TEXT,
  "attempt_number" INTEGER NOT NULL,
  "retryable" BOOLEAN NOT NULL DEFAULT false,
  "error_type" TEXT,
  "error_message" TEXT,
  "provider_message_id" TEXT,
  "state" "MessagingDeliveryState" NOT NULL DEFAULT 'SENT',
  "next_retry_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messaging_dead_letters" (
  "id" TEXT NOT NULL,
  "messaging_event_id" TEXT NOT NULL,
  "provider" "MessagingProvider" NOT NULL,
  "conversation_id" TEXT,
  "correlation_id" TEXT NOT NULL,
  "payload_ref" TEXT NOT NULL,
  "last_error_type" TEXT NOT NULL,
  "last_error_message" TEXT NOT NULL,
  "replay_hint" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_dead_letters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messaging_template_dispatches" (
  "id" TEXT NOT NULL,
  "provider" "MessagingProvider" NOT NULL,
  "conversation_id" TEXT,
  "template_key" TEXT NOT NULL,
  "provider_template_id" TEXT,
  "provider_message_id" TEXT,
  "correlation_id" TEXT,
  "payload_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_template_dispatches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tracking_link_dispatches" (
  "id" TEXT NOT NULL,
  "provider" "MessagingProvider" NOT NULL,
  "conversation_id" TEXT,
  "conversion_session_id" TEXT,
  "reference_code" TEXT NOT NULL,
  "tracking_url" TEXT NOT NULL,
  "provider_message_id" TEXT,
  "correlation_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tracking_link_dispatches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "messaging_events_idempotency_key_key"
  ON "messaging_events"("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "messaging_event_provider_provider_event_id_key"
  ON "messaging_events"("provider", "provider_event_id");
CREATE INDEX IF NOT EXISTS "messaging_events_provider_provider_message_id_idx"
  ON "messaging_events"("provider", "provider_message_id");
CREATE INDEX IF NOT EXISTS "messaging_events_event_status_next_retry_at_idx"
  ON "messaging_events"("event_status", "next_retry_at");

CREATE INDEX IF NOT EXISTS "messaging_delivery_attempts_messaging_event_id_attempt_number_idx"
  ON "messaging_delivery_attempts"("messaging_event_id", "attempt_number");

CREATE INDEX IF NOT EXISTS "messaging_dead_letters_status_created_at_idx"
  ON "messaging_dead_letters"("status", "created_at");

CREATE INDEX IF NOT EXISTS "messaging_template_dispatches_provider_conversation_id_created_at_idx"
  ON "messaging_template_dispatches"("provider", "conversation_id", "created_at");

CREATE INDEX IF NOT EXISTS "tracking_link_dispatches_conversion_session_id_created_at_idx"
  ON "tracking_link_dispatches"("conversion_session_id", "created_at");

ALTER TABLE "messaging_delivery_attempts"
  ADD CONSTRAINT "messaging_delivery_attempts_messaging_event_id_fkey"
  FOREIGN KEY ("messaging_event_id") REFERENCES "messaging_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messaging_dead_letters"
  ADD CONSTRAINT "messaging_dead_letters_messaging_event_id_fkey"
  FOREIGN KEY ("messaging_event_id") REFERENCES "messaging_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
