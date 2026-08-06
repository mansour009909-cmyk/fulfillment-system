import { prisma } from "./prisma";

// تنبيه فوري خارج موعد الطلب الدوري: كتب مخزونها الحالي وصل لنصف (أو أقل) ما بيع
// بفترة التقرير — قسم 8.6. لا يعتمد على وجود طلبية مقترحة نشطة.
export async function getFastSellingAlerts(supplierId) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return [];

  const catalog = await prisma.book.findMany({ where: { supplierId } });
  const periodStart = new Date(Date.now() - supplier.salesPeriodDays * 24 * 60 * 60 * 1000);

  const alerts = [];
  for (const book of catalog) {
    const items = await prisma.orderItem.findMany({
      where: {
        bookId: book.id,
        order: { status: "FULFILLED", charge: { createdAt: { gte: periodStart } } },
      },
    });
    const soldInPeriod = items.reduce((sum, i) => sum + i.quantityVerified, 0);
    if (soldInPeriod === 0) continue;

    const stockRows = await prisma.shelfStock.findMany({
      where: { bookId: book.id, ownership: "SHARED" },
    });
    const currentStock = stockRows.reduce((sum, s) => sum + s.quantity, 0);

    if (currentStock <= soldInPeriod / 2) {
      alerts.push({ bookId: book.id, title: book.title, barcode: book.barcode, soldInPeriod, currentStock });
    }
  }

  return alerts.sort((a, b) => a.currentStock - b.currentStock);
}
