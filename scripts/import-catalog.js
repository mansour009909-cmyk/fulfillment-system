// يستورد كتالوج الكتب↔الموردين من scripts/catalog_import.json (نتاج read_inventory_xlsx.py)
// لا يمس ShelfStock أو الكميات أو الأسعار — استيراد هوية/كتالوج فقط (أي كتاب يتبع أي مورد).
// الاستخدام: node scripts/import-catalog.js
const fs = require("fs");
const path = require("path");
const { prisma } = require("../lib/prisma");

async function main() {
  const jsonPath = path.join(__dirname, "catalog_import.json");
  const rows = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  const supplierCache = new Map();
  async function findOrCreateSupplier(name) {
    if (supplierCache.has(name)) return supplierCache.get(name);
    let supplier = await prisma.supplier.findFirst({ where: { name } });
    if (!supplier) supplier = await prisma.supplier.create({ data: { name } });
    supplierCache.set(name, supplier);
    return supplier;
  }

  let suppliersCreated = 0;
  let booksCreated = 0;
  let booksUpdated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.barcode || !row.supplierName) {
      skipped++;
      continue;
    }

    let supplier = supplierCache.get(row.supplierName);
    const existedBefore = supplier || (await prisma.supplier.findFirst({ where: { name: row.supplierName } }));
    supplier = await findOrCreateSupplier(row.supplierName);
    if (!existedBefore) suppliersCreated++;

    const existingBook = await prisma.book.findUnique({ where: { barcode: row.barcode } });
    if (existingBook) {
      if (existingBook.supplierId !== supplier.id) {
        await prisma.book.update({ where: { id: existingBook.id }, data: { supplierId: supplier.id } });
        booksUpdated++;
      }
    } else {
      await prisma.book.create({
        data: { barcode: row.barcode, title: row.title, supplierId: supplier.id },
      });
      booksCreated++;
    }
  }

  console.log("=== ملخص الاستيراد ===");
  console.log("موردون جدد:", suppliersCreated);
  console.log("كتب جديدة:", booksCreated);
  console.log("كتب حُدِّث موردها:", booksUpdated);
  console.log("صفوف متجاهَلة:", skipped);
  console.log("إجمالي الموردين بالكتالوج:", supplierCache.size);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
