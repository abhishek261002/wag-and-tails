-- CreateEnum
CREATE TYPE "PetSpecies" AS ENUM ('dog', 'cat');

-- CreateEnum
CREATE TYPE "PetVaccinationStatus" AS ENUM ('recorded', 'not_vaccinated_yet', 'unknown');

-- AlterEnum
ALTER TYPE "CoatType" ADD VALUE 'hairless';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "pet_species" "PetSpecies" NOT NULL DEFAULT 'dog';

-- AlterTable
ALTER TABLE "grooming_packages" ADD COLUMN     "applicable_species" TEXT[] DEFAULT ARRAY['dog', 'cat']::TEXT[];

-- AlterTable
ALTER TABLE "partner_profiles" ADD COLUMN     "pet_species" TEXT[] DEFAULT ARRAY['dog', 'cat']::TEXT[];

-- AlterTable
ALTER TABLE "pets" ADD COLUMN     "species" "PetSpecies" NOT NULL DEFAULT 'dog',
ADD COLUMN     "vaccination_status" "PetVaccinationStatus" NOT NULL DEFAULT 'unknown';

-- Backfill: pets that already have vaccination rows are 'recorded'
UPDATE "pets" SET "vaccination_status" = 'recorded'
WHERE EXISTS (SELECT 1 FROM "pet_vaccinations" v WHERE v."pet_id" = "pets"."id");
