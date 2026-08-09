/*
  Warnings:

  - You are about to drop the column `daftraApiKey` on the `SystemSetting` table. All the data in the column will be lost.
  - You are about to drop the column `daftraSubdomain` on the `SystemSetting` table. All the data in the column will be lost.
  - You are about to drop the column `shippingAccountNumber` on the `SystemSetting` table. All the data in the column will be lost.
  - You are about to drop the column `shippingApiKey` on the `SystemSetting` table. All the data in the column will be lost.
  - You are about to drop the column `shippingCarrier` on the `SystemSetting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SystemSetting" DROP COLUMN "daftraApiKey",
DROP COLUMN "daftraSubdomain",
DROP COLUMN "shippingAccountNumber",
DROP COLUMN "shippingApiKey",
DROP COLUMN "shippingCarrier";

-- CreateTable
CREATE TABLE "Integration" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "clientId" INTEGER,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "accountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_provider_clientId_key" ON "Integration"("provider", "clientId");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
