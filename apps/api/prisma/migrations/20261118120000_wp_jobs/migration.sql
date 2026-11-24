-- WordPress-linked jobs (B2-B7)
ALTER TYPE "BookingChannel" ADD VALUE 'website';

ALTER TABLE "bookings" ADD COLUMN "wp_ref" TEXT,
ADD COLUMN "wp_rev" INTEGER,
ADD COLUMN "wp_source" TEXT,
ADD COLUMN "wp_city_id" TEXT,
ADD COLUMN "wp_status" TEXT,
ADD COLUMN "pet_aggression" TEXT,
ADD COLUMN "escalate_at" TIMESTAMP(3),
ADD COLUMN "escalated_at" TIMESTAMP(3),
ADD COLUMN "staff_flag" TEXT,
ADD COLUMN "staff_flag_note" TEXT,
ADD COLUMN "staff_flag_at" TIMESTAMP(3),
ADD COLUMN "reconfirm_by" TIMESTAMP(3),
ADD COLUMN "late_flagged_at" TIMESTAMP(3),
ADD COLUMN "no_show_photo" TEXT,
ADD COLUMN "track_token" TEXT;
CREATE UNIQUE INDEX "bookings_wp_ref_key" ON "bookings"("wp_ref");
CREATE UNIQUE INDEX "bookings_track_token_key" ON "bookings"("track_token");
CREATE INDEX "bookings_escalate_at_idx" ON "bookings"("escalate_at");

ALTER TABLE "partner_profiles" ADD COLUMN "release_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "wp_outbox" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_id" UUID,
    "kind" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "done_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wp_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wp_outbox_dedupe_key_key" ON "wp_outbox"("dedupe_key");
CREATE INDEX "wp_outbox_done_at_failed_at_next_attempt_at_idx" ON "wp_outbox"("done_at", "failed_at", "next_attempt_at");
