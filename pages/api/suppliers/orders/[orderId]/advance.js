import { prisma } from "../../../../../lib/prisma";

const NEXT_STATUS = { PROPOSED: "ORDERED", ORDERED: "SHIPPED", SHIPPED: "ARRIVED" };
const TIMESTAMP_FIELD = { ORDERED: "orderedAt", SHIPPED: "shippedAt", ARRIVED: "arrivedAt" };

// يقدّم حالة الطلبية خطوة واحدة (مقترح→طلب→شحن→وصول) — قسم 8.7
// عند "تم الوصول" ينشئ فاتورة شراء مسودة تلقائيًا وتدخل بنفس مسار الاستلام/المطابقة/الاعتماد الحالي
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orderId = Number(req.query.orderId);
  const { toStatus, prices } = req.body;

  const order = await prisma.supplierOrder.findUnique({
    where: { id: orderId },
    include: { items: { include: { book: true } } },
  });
  if (!order) {
    return res.status(404).json({ error: "الطلبية غير موجودة" });
  }

  const expectedNext = NEXT_STATUS[order.status];
  if (!expectedNext || expectedNext !== toStatus) {
    return res.status(400).json({ error: `لا يمكن الانتقال من "${order.status}" إلى "${toStatus}" مباشرة` });
  }

  const includedItems = order.items.filter((i) => i.included && i.quantityFinal > 0);

  if (toStatus === "ARRIVED") {
    if (includedItems.length === 0) {
      return res.status(400).json({ error: "لا توجد بنود مُدرَجة بهذي الطلبية" });
    }
    for (const item of includedItems) {
      const price = Number(prices?.[item.bookId]);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: `أدخل سعر وحدة صحيح لكتاب "${item.book.title}"` });
      }
    }

    const invoice = await prisma.purchaseInvoice.create({
      data: {
        supplierId: order.supplierId,
        type: "PURCHASE",
        items: {
          create: includedItems.map((item) => ({
            bookId: item.bookId,
            quantityExpected: item.quantityFinal,
            price: Number(prices[item.bookId]),
          })),
        },
      },
    });

    await prisma.supplierOrder.update({
      where: { id: orderId },
      data: { status: "ARRIVED", arrivedAt: new Date(), purchaseInvoiceId: invoice.id },
    });

    return res.status(200).json({ ok: true, purchaseInvoiceId: invoice.id });
  }

  await prisma.supplierOrder.update({
    where: { id: orderId },
    data: { status: toStatus, [TIMESTAMP_FIELD[toStatus]]: new Date() },
  });

  return res.status(200).json({ ok: true });
}
