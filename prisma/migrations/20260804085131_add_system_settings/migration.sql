-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "warehouseName" TEXT NOT NULL DEFAULT 'المستودع الرئيسي',
    "importantSupplierSharePercent" REAL NOT NULL DEFAULT 80,
    "minOrderQtyTotal" INTEGER NOT NULL DEFAULT 50,
    "minOrderQtyPerTitle" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" DATETIME NOT NULL
);

