-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "ticket_id" UUID;

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "escalated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "escalated_at" TIMESTAMP(3),
ADD COLUMN     "escalated_reason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "conversations_ticket_id_key" ON "conversations"("ticket_id");

-- CreateIndex
CREATE INDEX "support_tickets_escalated_idx" ON "support_tickets"("escalated");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
