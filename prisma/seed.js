// بيانات تجريبية لتجربة النظام أول مرة
const { PrismaClient } = require("@prisma/client");
const { randomBytes, scryptSync } = require("crypto");
const prisma = new PrismaClient();

// نسخة CJS بسيطة من lib/crypto.js (لا يمكن استيراد ESM هنا) — نفس أسلوب scrypt+salt
function hashSecret(plain) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(plain), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const shelfA = await prisma.shelf.upsert({
    where: { barcode: "SHF-0001" },
    update: {},
    create: { barcode: "SHF-0001", name: "رف A1", sortOrder: 1 },
  });
  const shelfB = await prisma.shelf.upsert({
    where: { barcode: "SHF-0002" },
    update: {},
    create: { barcode: "SHF-0002", name: "رف A2", sortOrder: 2 },
  });

  const book1 = await prisma.book.upsert({
    where: { barcode: "BK-1001" },
    update: {},
    create: { barcode: "BK-1001", title: "الفضيلة" },
  });
  const book2 = await prisma.book.upsert({
    where: { barcode: "BK-1002" },
    update: {},
    create: { barcode: "BK-1002", title: "كليلة ودمنة" },
  });

  // find + create/update بدل upsert على المفتاح المركّب، لأن Prisma لا يسمح
  // بـ null داخل where لمفتاح فريد مركّب (clientId قد يكون null هنا)
  async function upsertSharedStock(shelfId, bookId, quantity) {
    const existing = await prisma.shelfStock.findFirst({
      where: { shelfId, bookId, ownership: "SHARED", clientId: null },
    });
    if (existing) {
      await prisma.shelfStock.update({ where: { id: existing.id }, data: { quantity } });
    } else {
      await prisma.shelfStock.create({ data: { shelfId, bookId, quantity } });
    }
  }

  await upsertSharedStock(shelfA.id, book1.id, 5);
  await upsertSharedStock(shelfB.id, book2.id, 3);

  // المرحلة 2: عميل تجريبي + طلبات بانتظار المراجعة
  let client = await prisma.client.findFirst({ where: { name: "متجر السعادة" } });
  if (!client) {
    client = await prisma.client.create({ data: { name: "متجر السعادة" } });
  }

  const sampleOrders = [
    { orderNumber: "RWD-10089", items: [{ book: book1, qty: 2 }, { book: book2, qty: 1 }] },
    { orderNumber: "RWD-10090", items: [{ book: book1, qty: 1 }] },
    { orderNumber: "RWD-10091", items: [{ book: book2, qty: 2 }] },
    { orderNumber: "RWD-10092", items: [{ book: book1, qty: 1 }, { book: book2, qty: 1 }] },
    { orderNumber: "RWD-10093", items: [{ book: book1, qty: 3 }] },
  ];

  for (const o of sampleOrders) {
    const existing = await prisma.order.findUnique({ where: { orderNumber: o.orderNumber } });
    if (existing) continue;

    await prisma.order.create({
      data: {
        orderNumber: o.orderNumber,
        clientId: client.id,
        status: "PENDING_REVIEW",
        items: {
          create: o.items.map((i) => ({ bookId: i.book.id, quantityRequired: i.qty })),
        },
      },
    });
  }

  // المرحلة 4: أسعار عامة افتراضية (clientId فارغ = سعر عام)
  // findFirst + create/update بدل upsert على مفتاح فيه null (نفس سبب upsertSharedStock أعلاه)
  async function upsertGeneralFee(type, amount) {
    const existing = await prisma.fee.findFirst({ where: { type, clientId: null } });
    if (existing) {
      await prisma.fee.update({ where: { id: existing.id }, data: { amount } });
    } else {
      await prisma.fee.create({ data: { type, amount } });
    }
  }

  const defaultFees = {
    FULFILLMENT: 45,
    LABEL: 25,
    SHIPPING: 25,
    CARTON_SMALL: 2,
    CARTON_LARGE: 5,
    BUBBLES: 1,
    SHIPPING_BAG: 0.75,
    STORAGE: 0.25,
  };
  for (const [type, amount] of Object.entries(defaultFees)) {
    await upsertGeneralFee(type, amount);
  }

  await prisma.systemSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  // حساب المدير الافتراضي (موظف موحّد بدخول ويب فقط) — admin / admin123 — يُغيَّر فورًا من صفحة الموظف
  const existingManager = await prisma.employee.findFirst({ where: { role: "MANAGER" } });
  if (!existingManager) {
    await prisma.employee.create({
      data: { name: "admin", username: "admin", passwordHash: hashSecret("admin123"), role: "MANAGER" },
    });
    console.log('حساب المدير الافتراضي: admin / admin123 — غيّره فورًا من صفحة "الموظفون"');
  }

  console.log("تم زرع البيانات التجريبية بنجاح ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
