-- CreateTable
CREATE TABLE "TikTokCredential" (
    "id" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "appSecret" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL DEFAULT '',
    "refreshToken" TEXT NOT NULL DEFAULT '',
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:00',
    "shopId" TEXT NOT NULL DEFAULT '',
    "shopCipher" TEXT NOT NULL DEFAULT '',
    "shopName" TEXT NOT NULL DEFAULT '',
    "openId" TEXT NOT NULL DEFAULT '',
    "sellerRegion" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TikTokCredential_tokenExpiresAt_idx" ON "TikTokCredential"("tokenExpiresAt");
