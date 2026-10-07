-- AlterTable
ALTER TABLE "customer_profiles" ADD COLUMN     "city" TEXT;

-- CreateTable
CREATE TABLE "pet_medical_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pet_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "record_date" DATE NOT NULL,
    "notes" TEXT,
    "vet_name" TEXT,
    "follow_up_date" DATE,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pet_medical_records_pet_id_idx" ON "pet_medical_records"("pet_id");

-- CreateIndex
CREATE INDEX "pet_medical_records_follow_up_date_idx" ON "pet_medical_records"("follow_up_date");

-- AddForeignKey
ALTER TABLE "pet_medical_records" ADD CONSTRAINT "pet_medical_records_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

