-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KycRequestStatus" ADD VALUE 'redirect_started';
ALTER TYPE "KycRequestStatus" ADD VALUE 'failed';
ALTER TYPE "KycRequestStatus" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "kyc_requests" ADD COLUMN     "app_redirect" TEXT,
ADD COLUMN     "code_verifier" TEXT,
ADD COLUMN     "failure_reason" TEXT,
ADD COLUMN     "hint_age" INTEGER,
ADD COLUMN     "hint_name" TEXT,
ADD COLUMN     "state" TEXT,
ALTER COLUMN "aadhaar_ref_hash" DROP NOT NULL,
ALTER COLUMN "aadhaar_last4" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "kyc_requests_state_key" ON "kyc_requests"("state");

