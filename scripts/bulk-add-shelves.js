// إنشاء عدد كبير من الرفوف دفعة وحدة (غرف كاملة) بدل تسجيلها يدويًا رف رف.
// كل رف: باركود + اسم بنمط "<غرفة>-<رقم>"، وترتيب لقط متسلسل يكمل من آخر رقم موجود بالنظام.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ROOMS = [
  { prefix: "A", count: 259 },
  { prefix: "B", count: 275 },
];

async function main() {
  const maxSort = await prisma.shelf.aggregate({ _max: { sortOrder: true } });
  let nextSort = (maxSort._max.sortOrder || 0) + 1;

  const data = [];
  for (const room of ROOMS) {
    for (let i = 1; i <= room.count; i++) {
      const num = String(i).padStart(3, "0");
      const code = `${room.prefix}-${num}`;
      data.push({ barcode: code, name: `رف ${code}`, sortOrder: nextSort++ });
    }
  }

  const result = await prisma.shelf.createMany({ data, skipDuplicates: true });
  console.log("=== ملخص إضافة الرفوف ===");
  console.log("تم إنشاؤها:", result.count);
  console.log("مطلوب إجمالي:", data.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
