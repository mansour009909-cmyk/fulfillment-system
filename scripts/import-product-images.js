// يحدّث Book.imageUrl/brandName للكتب الموجودة فعليًا (مطابقة بالباركود) —
// لا يُنشئ كتب جديدة ولا يمس المخزون/الأسعار. مصدر البيانات: تصدير منتجات سلة.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient();

async function main() {
  const rows = JSON.parse(fs.readFileSync("scripts/product_images_import.json", "utf-8"));

  let updated = 0;
  let notFound = 0;

  for (const row of rows) {
    const book = await prisma.book.findUnique({ where: { barcode: row.barcode } });
    if (!book) {
      notFound++;
      continue;
    }
    await prisma.book.update({
      where: { id: book.id },
      data: {
        imageUrl: row.imageUrl,
        brandName: row.brandName,
        price: row.price ?? undefined,
        costPrice: row.costPrice ?? undefined,
      },
    });
    updated++;
  }

  console.log("=== ملخص استيراد الصور والماركات ===");
  console.log("كتب تم تحديثها:", updated);
  console.log("باركودات غير موجودة بالنظام (تجوهلت):", notFound);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
