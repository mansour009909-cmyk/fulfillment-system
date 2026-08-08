// يحدّث Book.brandImageUrl لكل الكتب اللي brandName مطابق — دفعة واحدة لكل ماركة (updateMany)
// بدل المرور على كل كتاب لحاله، أسرع بكثير من استيراد الكتب نفسها.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient();

async function main() {
  const brands = JSON.parse(fs.readFileSync("scripts/brands_import.json", "utf-8"));

  let matchedBrands = 0;
  let updatedBooks = 0;

  for (const b of brands) {
    const result = await prisma.book.updateMany({
      where: { brandName: b.brandName },
      data: { brandImageUrl: b.logoUrl },
    });
    if (result.count > 0) {
      matchedBrands++;
      updatedBooks += result.count;
    }
  }

  console.log("=== ملخص استيراد شعارات الماركات ===");
  console.log("ماركات طابقت كتبًا موجودة:", matchedBrands, "من", brands.length);
  console.log("إجمالي الكتب المحدَّثة:", updatedBooks);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
