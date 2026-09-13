-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "end_otp" TEXT,
ADD COLUMN     "session_started_at" TIMESTAMP(3);
