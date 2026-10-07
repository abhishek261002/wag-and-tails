-- CreateEnum
CREATE TYPE "PartnerEmploymentType" AS ENUM ('team', 'freelancer');

-- CreateEnum
CREATE TYPE "InsuranceRequestStatus" AS ENUM ('new', 'contacted', 'closed');

-- AlterTable
ALTER TABLE "partner_profiles" ADD COLUMN     "employment_type" "PartnerEmploymentType";

-- CreateTable
CREATE TABLE "pet_insurance_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "customer_id" UUID NOT NULL,
    "pet_id" UUID,
    "pet_name" TEXT NOT NULL,
    "pet_species" TEXT NOT NULL,
    "pet_breed" TEXT NOT NULL,
    "pet_date_of_birth" DATE,
    "owner_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT NOT NULL,
    "plan_type" TEXT NOT NULL,
    "cover_amount" TEXT NOT NULL,
    "pre_existing" BOOLEAN NOT NULL DEFAULT false,
    "pre_existing_details" TEXT,
    "preferred_call_time" TEXT NOT NULL,
    "notes" TEXT,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "status" "InsuranceRequestStatus" NOT NULL DEFAULT 'new',
    "staff_note" TEXT,
    "handled_by" UUID,
    "handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_insurance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pet_insurance_requests_status_created_at_idx" ON "pet_insurance_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "pet_insurance_requests_customer_id_idx" ON "pet_insurance_requests"("customer_id");

-- AddForeignKey
ALTER TABLE "pet_insurance_requests" ADD CONSTRAINT "pet_insurance_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_insurance_requests" ADD CONSTRAINT "pet_insurance_requests_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

