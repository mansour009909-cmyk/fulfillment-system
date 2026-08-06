-- AlterTable
ALTER TABLE "Client" ADD COLUMN "email" TEXT;
ALTER TABLE "Client" ADD COLUMN "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "email" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PickingBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "employeeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "PickingBatch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PickingBatchOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "boxNumber" INTEGER NOT NULL,
    CONSTRAINT "PickingBatchOrder_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PickingBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PickingBatchOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNumber" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "size" TEXT,
    "boxScanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledByEmployeeId" INTEGER,
    CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_fulfilledByEmployeeId_fkey" FOREIGN KEY ("fulfilledByEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("boxScanned", "clientId", "createdAt", "id", "orderNumber", "size", "status") SELECT "boxScanned", "clientId", "createdAt", "id", "orderNumber", "size", "status" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE TABLE "new_OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "bookId" INTEGER NOT NULL,
    "quantityRequired" INTEGER NOT NULL,
    "quantityPicked" INTEGER NOT NULL DEFAULT 0,
    "quantityVerified" INTEGER NOT NULL DEFAULT 0,
    "quantityShort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("bookId", "id", "orderId", "quantityPicked", "quantityRequired", "quantityVerified") SELECT "bookId", "id", "orderId", "quantityPicked", "quantityRequired", "quantityVerified" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE TABLE "new_SystemSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "warehouseName" TEXT NOT NULL DEFAULT 'المستودع الرئيسي',
    "importantSupplierSharePercent" REAL NOT NULL DEFAULT 80,
    "minOrderQtyTotal" INTEGER NOT NULL DEFAULT 50,
    "minOrderQtyPerTitle" INTEGER NOT NULL DEFAULT 2,
    "defaultSalesPeriodDays" INTEGER NOT NULL DEFAULT 90,
    "delayDaysDomestic" INTEGER NOT NULL DEFAULT 7,
    "delayDaysInternational" INTEGER NOT NULL DEFAULT 21,
    "adminUsername" TEXT NOT NULL DEFAULT 'admin',
    "adminPasswordHash" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SystemSetting" ("defaultSalesPeriodDays", "delayDaysDomestic", "delayDaysInternational", "id", "importantSupplierSharePercent", "minOrderQtyPerTitle", "minOrderQtyTotal", "updatedAt", "warehouseName") SELECT "defaultSalesPeriodDays", "delayDaysDomestic", "delayDaysInternational", "id", "importantSupplierSharePercent", "minOrderQtyPerTitle", "minOrderQtyTotal", "updatedAt", "warehouseName" FROM "SystemSetting";
DROP TABLE "SystemSetting";
ALTER TABLE "new_SystemSetting" RENAME TO "SystemSetting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PickingBatchOrder_orderId_key" ON "PickingBatchOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PickingBatchOrder_batchId_boxNumber_key" ON "PickingBatchOrder"("batchId", "boxNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_email_key" ON "Supplier"("email");

