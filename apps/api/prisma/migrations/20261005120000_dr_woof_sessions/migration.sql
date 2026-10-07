-- DropForeignKey
ALTER TABLE "ai_chat_sessions" DROP CONSTRAINT "ai_chat_sessions_pet_id_fkey";

-- AlterTable
ALTER TABLE "ai_chat_sessions" ALTER COLUMN "pet_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

