-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "carrierName" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippingStatus" TEXT NOT NULL DEFAULT 'NOT_SHIPPED',
ADD COLUMN     "trackingNumber" TEXT;
