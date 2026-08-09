-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "daftraClientId" TEXT;

-- AlterTable
ALTER TABLE "ClientInvoice" ADD COLUMN     "daftraInvoiceId" TEXT,
ADD COLUMN     "daftraSyncError" TEXT,
ADD COLUMN     "daftraSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "daftraApiKey" TEXT,
ADD COLUMN     "daftraSubdomain" TEXT,
ADD COLUMN     "shippingAccountNumber" TEXT,
ADD COLUMN     "shippingApiKey" TEXT,
ADD COLUMN     "shippingCarrier" TEXT;
