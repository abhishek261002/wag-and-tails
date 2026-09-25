-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('any', 'specific');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "assignment_mode" "AssignmentMode" NOT NULL DEFAULT 'any',
ADD COLUMN     "request_expires_at" TIMESTAMP(3),
ADD COLUMN     "request_outcome" TEXT,
ADD COLUMN     "requested_partner_id" UUID;

-- CreateIndex
CREATE INDEX "bookings_requested_partner_id_idx" ON "bookings"("requested_partner_id");

