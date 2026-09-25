-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('commission_due', 'commission_paid', 'payout_offset', 'adjustment');

-- CreateEnum
CREATE TYPE "PartnerDiscountStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "CommissionPaymentStatus" AS ENUM ('pending', 'paid', 'failed');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "commission_amount" DECIMAL(10,2),
ADD COLUMN     "commission_pct" DECIMAL(5,2),
ADD COLUMN     "discount_source" TEXT,
ADD COLUMN     "partner_discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "partner_discount_pct" DECIMAL(5,2),
ADD COLUMN     "partner_share_amount" DECIMAL(10,2),
ADD COLUMN     "settled_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "partner_profiles" ADD COLUMN     "commission_limit_override" DECIMAL(10,2),
ADD COLUMN     "commission_pct" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "default_commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "commission_limit" DECIMAL(10,2) NOT NULL DEFAULT 1500,
    "max_partner_discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_discounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "partner_id" UUID NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "PartnerDiscountStatus" NOT NULL DEFAULT 'active',
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "activated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_ledger_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "partner_id" UUID NOT NULL,
    "booking_id" UUID,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "partner_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "CommissionPaymentStatus" NOT NULL DEFAULT 'pending',
    "provider_order_id" TEXT NOT NULL,
    "provider_payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "commission_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_discounts_partner_id_status_idx" ON "partner_discounts"("partner_id", "status");

-- CreateIndex
CREATE INDEX "partner_ledger_entries_partner_id_created_at_idx" ON "partner_ledger_entries"("partner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "partner_ledger_entries_booking_id_type_key" ON "partner_ledger_entries"("booking_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "commission_payments_provider_payment_id_key" ON "commission_payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "commission_payments_partner_id_status_idx" ON "commission_payments"("partner_id", "status");

-- AddForeignKey
ALTER TABLE "partner_discounts" ADD CONSTRAINT "partner_discounts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_ledger_entries" ADD CONSTRAINT "partner_ledger_entries_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the single settings row
INSERT INTO "platform_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
