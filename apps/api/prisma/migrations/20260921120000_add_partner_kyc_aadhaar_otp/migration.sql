-- CreateEnum
CREATE TYPE "KycRequestStatus" AS ENUM ('otp_sent', 'verified', 'locked', 'expired', 'consumed');

-- CreateEnum
CREATE TYPE "PartnerKycStatus" AS ENUM ('verified', 'legacy_unverified');

-- AlterTable
ALTER TABLE "partner_profiles" ADD COLUMN     "aadhaar_last4" TEXT,
ADD COLUMN     "aadhaar_ref_hash" TEXT,
ADD COLUMN     "kyc_address" TEXT,
ADD COLUMN     "kyc_consent_at" TIMESTAMP(3),
ADD COLUMN     "kyc_dob" DATE,
ADD COLUMN     "kyc_gender" TEXT,
ADD COLUMN     "kyc_name" TEXT,
ADD COLUMN     "kyc_name_match" BOOLEAN,
ADD COLUMN     "kyc_provider" TEXT,
ADD COLUMN     "kyc_status" "PartnerKycStatus" NOT NULL DEFAULT 'legacy_unverified',
ADD COLUMN     "kyc_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "kyc_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "aadhaar_ref_hash" TEXT NOT NULL,
    "aadhaar_last4" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_ref" TEXT,
    "status" "KycRequestStatus" NOT NULL DEFAULT 'otp_sent',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ip_hash" TEXT,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "identity_name" TEXT,
    "identity_dob" DATE,
    "identity_gender" TEXT,
    "identity_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kyc_requests_aadhaar_ref_hash_created_at_idx" ON "kyc_requests"("aadhaar_ref_hash", "created_at");

-- CreateIndex
CREATE INDEX "kyc_requests_ip_hash_created_at_idx" ON "kyc_requests"("ip_hash", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "partner_profiles_aadhaar_ref_hash_key" ON "partner_profiles"("aadhaar_ref_hash");

