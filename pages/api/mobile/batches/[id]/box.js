import { prisma } from "../../../../../lib/prisma";
import { requireEmployee } from "../../../../../lib/mobileAuth";

// يبحث عن الصندوق (الطلب) داخل الدفعة الحالية بواسطة باركود/رقم الطلب المطبوع (?code=)
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const { code } = req.query;
  const batchOrder = await prisma.pickingBatchOrder.findFirst({
    where: { batchId: Number(req.query.id), order: { orderNumber: code } },
    include: { order: { include: { items: { include: { book: true } }, client: true } } },
  });
  if (!batchOrder) {
    return res.status(404).json({ error: "ما فيه طلب بهذا الرقم/الباركود ضمن الدفعة الحالية" });
  }

  return res.status(200).json({
    box: {
      orderId: batchOrder.order.id,
      boxNumber: batchOrder.boxNumber,
      orderNumber: batchOrder.order.orderNumber,
      clientName: batchOrder.order.client.name,
      boxScanned: batchOrder.order.boxScanned,
      items: batchOrder.order.items.map((i) => ({
        bookId: i.bookId,
        title: i.book.title,
        barcode: i.book.barcode,
        imageUrl: i.book.imageUrl,
        brandName: i.book.brandName,
        quantityRequired: i.quantityRequired,
        quantityVerified: i.quantityVerified,
      })),
    },
  });
}
