import { prisma } from "../../../../../lib/prisma";

// تعديل الكمية النهائية/الإدراج لبنود طلبية مقترحة — قبل "تأكيد الطلب" فقط
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orderId = Number(req.query.orderId);
  const { items } = req.body; // [{ bookId, quantityFinal, included }]

  const order = await prisma.supplierOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    return res.status(404).json({ error: "الطلبية غير موجودة" });
  }
  if (order.status !== "PROPOSED") {
    return res.status(400).json({ error: "لا يمكن تعديل بنود الطلبية بعد تأكيد الطلب" });
  }
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "بيانات غير صحيحة" });
  }

  for (const item of items) {
    const qty = Number(item.quantityFinal);
    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({ error: `كمية غير صحيحة للكتاب ${item.bookId}` });
    }
    await prisma.supplierOrderItem.updateMany({
      where: { supplierOrderId: orderId, bookId: Number(item.bookId) },
      data: { quantityFinal: qty, included: Boolean(item.included) },
    });
  }

  return res.status(200).json({ ok: true });
}
