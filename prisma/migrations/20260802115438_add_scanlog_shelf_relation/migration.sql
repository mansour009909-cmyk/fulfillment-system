-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShelfScanLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shelfId" INTEGER NOT NULL,
    "bookBarcode" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShelfScanLog_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ShelfScanLog" ("bookBarcode", "id", "quantityDelta", "scannedAt", "shelfId") SELECT "bookBarcode", "id", "quantityDelta", "scannedAt", "shelfId" FROM "ShelfScanLog";
DROP TABLE "ShelfScanLog";
ALTER TABLE "new_ShelfScanLog" RENAME TO "ShelfScanLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
