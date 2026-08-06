-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SystemSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "warehouseName" TEXT NOT NULL DEFAULT 'المستودع الرئيسي',
    "importantSupplierSharePercent" REAL NOT NULL DEFAULT 80,
    "minOrderQtyTotal" INTEGER NOT NULL DEFAULT 50,
    "minOrderQtyPerTitle" INTEGER NOT NULL DEFAULT 2,
    "defaultSalesPeriodDays" INTEGER NOT NULL DEFAULT 90,
    "delayDaysDomestic" INTEGER NOT NULL DEFAULT 7,
    "delayDaysInternational" INTEGER NOT NULL DEFAULT 21,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SystemSetting" ("id", "importantSupplierSharePercent", "minOrderQtyPerTitle", "minOrderQtyTotal", "updatedAt", "warehouseName") SELECT "id", "importantSupplierSharePercent", "minOrderQtyPerTitle", "minOrderQtyTotal", "updatedAt", "warehouseName" FROM "SystemSetting";
DROP TABLE "SystemSetting";
ALTER TABLE "new_SystemSetting" RENAME TO "SystemSetting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

