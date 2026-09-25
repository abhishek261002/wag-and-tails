-- AlterTable
ALTER TABLE "products" ADD COLUMN     "sku" TEXT;

-- CreateTable
CREATE TABLE "catalog_imports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "created_by" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "summary" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_imports_created_at_idx" ON "catalog_imports"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

