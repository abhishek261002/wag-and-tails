-- CreateTable
CREATE TABLE "partner_tool_media" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "partner_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_tool_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_tool_media_partner_id_idx" ON "partner_tool_media"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_tool_media_partner_id_url_key" ON "partner_tool_media"("partner_id", "url");

-- AddForeignKey
ALTER TABLE "partner_tool_media" ADD CONSTRAINT "partner_tool_media_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

