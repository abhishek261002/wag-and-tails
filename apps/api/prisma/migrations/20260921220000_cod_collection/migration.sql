-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "collected_amount" DECIMAL(10,2),
ADD COLUMN     "collected_at" TIMESTAMP(3),
ADD COLUMN     "collected_method" TEXT;

