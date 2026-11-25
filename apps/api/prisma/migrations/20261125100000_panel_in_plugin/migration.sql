-- Everything in the plugin: partner rejection, stored Aadhaar (encrypted), WooCommerce store ids, insurance lead ref.
ALTER TABLE "partner_profiles" ADD COLUMN "reject_reason" TEXT;
ALTER TABLE "partner_profiles" ADD COLUMN "rejected_at" TIMESTAMP(3);
ALTER TABLE "partner_profiles" ADD COLUMN "aadhaar_enc" TEXT;
ALTER TABLE "partner_profiles" ADD COLUMN "aadhaar_num_hash" TEXT;
CREATE UNIQUE INDEX "partner_profiles_aadhaar_num_hash_key" ON "partner_profiles"("aadhaar_num_hash");
ALTER TABLE "partner_profiles" ADD COLUMN "aadhaar_front_file" TEXT;
ALTER TABLE "partner_profiles" ADD COLUMN "aadhaar_back_file" TEXT;
ALTER TABLE "partner_profiles" ADD COLUMN "aadhaar_docs_at" TIMESTAMP(3);

ALTER TABLE "products" ADD COLUMN "wc_id" INTEGER;
CREATE UNIQUE INDEX "products_wc_id_key" ON "products"("wc_id");
ALTER TABLE "product_variants" ADD COLUMN "wc_id" INTEGER;
CREATE UNIQUE INDEX "product_variants_wc_id_key" ON "product_variants"("wc_id");

ALTER TABLE "store_orders" ADD COLUMN "wc_order_id" INTEGER;
ALTER TABLE "store_orders" ADD COLUMN "wc_status" TEXT;
CREATE UNIQUE INDEX "store_orders_wc_order_id_key" ON "store_orders"("wc_order_id");

ALTER TABLE "pet_insurance_requests" ADD COLUMN "wp_ref" TEXT;
