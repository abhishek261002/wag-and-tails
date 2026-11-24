-- WordPress plugin config sync (B1)
ALTER TABLE "grooming_packages" ADD COLUMN "wp_id" TEXT;
ALTER TABLE "grooming_packages" ADD COLUMN "duration_minutes" INTEGER;
CREATE UNIQUE INDEX "grooming_packages_wp_id_key" ON "grooming_packages"("wp_id");

CREATE TABLE "grooming_package_city_prices" (
    "package_id" UUID NOT NULL,
    "city_id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "grooming_package_city_prices_pkey" PRIMARY KEY ("package_id","city_id")
);
ALTER TABLE "grooming_package_city_prices" ADD CONSTRAINT "grooming_package_city_prices_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "grooming_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coupons" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'app';

CREATE TABLE "wp_cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "service" BOOLEAN NOT NULL DEFAULT true,
    "walking" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wp_cities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wp_sync_state" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wp_sync_state_pkey" PRIMARY KEY ("key")
);
