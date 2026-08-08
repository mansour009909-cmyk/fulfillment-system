import { prisma } from "./prisma";

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
