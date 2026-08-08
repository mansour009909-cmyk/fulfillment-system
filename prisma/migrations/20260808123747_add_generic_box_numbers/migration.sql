-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "boxNumber" INTEGER;

-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "boxCount" INTEGER NOT NULL DEFAULT 30;
