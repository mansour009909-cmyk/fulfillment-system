import { prisma } from "./prisma";
import { getSettings } from "./settings";

// يحسب "المطلوب" وينشئ طلبية مقترحة جديدة لمورد (قسم 8.1 و8.3)
export async function proposeSupplierOrder(supplierId) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    throw new Error("المورد غير موجود");
  }

  const settings = await getSettings();
  const importantSupplierShare = settings.importantSupplierSharePercent / 100;
  const minQtyPerTitle = settings.minOrderQtyPerTitle;

  const catalog = await prisma.book.findMany({ where: { supplierId } });

  const periodStart = new Date(Date.now() - supplier.salesPeriodDays * 24 * 60 * 60 * 1000);

  const soldByBook = new Map();
  for (const book of catalog) {
    const items = await prisma.orderItem.findMany({
      where: {
        bookId: book.id,
        order: { status: "FULFILLED", charge: { createdAt: { gte: periodStart } } },
      },
    });
    const sold = items.reduce((sum, i) => sum + i.quantityVerified, 0);
    soldByBook.set(book.id, sold);
  }

  const sortedCatalog = [...catalog].sort(
    (a, b) => (soldByBook.get(b.id) || 0) - (soldByBook.get(a.id) || 0)
  );

  const includeCount =
    supplier.importance === "IMPORTANT" ? Math.ceil(sortedCatalog.length * importantSupplierShare) : 0;

  const itemsData = sortedCatalog.map((book, idx) => {
    const soldInPeriod = soldByBook.get(book.id) || 0;
    const included = idx < includeCount;
    const proposedQty = included ? Math.max(soldInPeriod, minQtyPerTitle) : 0;
    return {
      bookId: book.id,
      soldInPeriod,
      quantityProposed: proposedQty,
      quantityFinal: proposedQty,
      included,
    };
  });

  const order = await prisma.supplierOrder.create({
    data: { supplierId, items: { create: itemsData } },
  });

  return order.id;
}
