import { prisma } from "./prisma";

// يبحث عن كتب بعنوانها أو باركودها — يُستخدم لصفحة "المنتجات" بالجوال وأي منتقي بحث آخر
export async function searchBooks(q, { take = 20 } = {}) {
  const query = (q || "").trim();
  if (!query) {
    return prisma.book.findMany({ orderBy: { createdAt: "desc" }, take });
  }
  return prisma.book.findMany({
    where: { OR: [{ title: { contains: query } }, { barcode: { contains: query } }] },
    orderBy: { createdAt: "desc" },
    take,
  });
}

// تعديل بيانات كتالوج كتاب (عنوان/باركود/ماركة/أسعار) — لا يمس المخزون أو تاريخ الحركات
export async function updateBook(bookId, data) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return { error: { status: 404, body: { error: "الكتاب غير موجود" } } };

  const title = (data.title ?? "").trim();
  const barcode = (data.barcode ?? "").trim();
  if (!title) return { error: { status: 400, body: { error: "عنوان الكتاب مطلوب" } } };
  if (!barcode) return { error: { status: 400, body: { error: "باركود الكتاب مطلوب" } } };

  if (barcode !== book.barcode) {
    const clash = await prisma.book.findUnique({ where: { barcode } });
    if (clash) return { error: { status: 409, body: { error: "هذا الباركود مستخدَم بكتاب آخر" } } };
  }

  const price = data.price === "" || data.price == null ? null : Number(data.price);
  const costPrice = data.costPrice === "" || data.costPrice == null ? null : Number(data.costPrice);
  if (price != null && !Number.isFinite(price)) {
    return { error: { status: 400, body: { error: "سعر البيع غير صحيح" } } };
  }
  if (costPrice != null && !Number.isFinite(costPrice)) {
    return { error: { status: 400, body: { error: "سعر التكلفة غير صحيح" } } };
  }

  const updated = await prisma.book.update({
    where: { id: bookId },
    data: {
      title,
      barcode,
      brandName: data.brandName?.trim() || null,
      brandImageUrl: data.brandImageUrl?.trim() || null,
      imageUrl: data.imageUrl?.trim() || null,
      price,
      costPrice,
    },
  });

  return { result: updated };
}

// يحذف كتاب من الكتالوج نهائيًا — فقط لو ما له أي أثر تاريخي بالنظام (لا مخزون،
// لا طلبات، لا فواتير شراء) لتجنّب كسر سجلات حقيقية. لا يوجد خيار "حذف بالقوة"
// هنا (خلافًا للرفوف) لأن التاريخ المرتبط بالكتاب بيانات عمل حقيقية لا يصح فقدها.
export async function deleteBook(bookId) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      shelfStock: true,
      orderItems: true,
      purchaseInvoiceItems: true,
      receivingScans: true,
      supplierOrderItems: true,
    },
  });
  if (!book) return { error: { status: 404, body: { error: "الكتاب غير موجود" } } };

  const hasStock = book.shelfStock.some((s) => s.quantity > 0);
  if (hasStock) {
    return { error: { status: 409, body: { error: "لا يمكن حذف كتاب فيه مخزون بأي رف — أزل الكمية أولًا" } } };
  }
  if (book.orderItems.length > 0) {
    return { error: { status: 409, body: { error: "لا يمكن حذف كتاب مرتبط بطلبات عملاء سابقة" } } };
  }
  if (book.purchaseInvoiceItems.length > 0) {
    return { error: { status: 409, body: { error: "لا يمكن حذف كتاب مرتبط بفواتير شراء سابقة" } } };
  }
  if (book.receivingScans.length > 0) {
    return { error: { status: 409, body: { error: "لا يمكن حذف كتاب له سجل استلام سابق" } } };
  }
  if (book.supplierOrderItems.length > 0) {
    return { error: { status: 409, body: { error: "لا يمكن حذف كتاب مرتبط بطلبية آلية لمورد" } } };
  }

  await prisma.shelfStock.deleteMany({ where: { bookId } }); // صفوف بكمية 0 فقط (تحقّقنا أعلاه)
  await prisma.book.delete({ where: { id: bookId } });

  return { result: { ok: true } };
}
