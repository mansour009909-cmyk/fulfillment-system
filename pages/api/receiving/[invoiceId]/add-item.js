import { prisma } from "../../../../lib/prisma";

// يضيف بندًا جديدًا لفاتورة مسودة لكتاب وصل فعليًا (ممسوح) لكن ما كان مدرجًا بالفاتورة الأصلية
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const invoiceId = Number(req.query.invoiceId);
  const { bookId, quantityExpected, price } = req.body;
  const qty = Number(quantityExpected);
  const priceNum = Number(price);

  if (!bookId || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(priceNum) || priceNum < 0) {
    return res.status(400).json({ error: "بيانات غير صحيحة" });
  }

  const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return res.status(404).json({ error: "الفاتورة غير موجودة" });
  }
  if (invoice.status === "APPROVED") {
    return res.status(400).json({ error: "لا يمكن تعديل فاتورة معتمدة" });
  }

  const existing = await prisma.purchaseInvoiceItem.findFirst({
    where: { invoiceId, bookId: Number(bookId) },
  });
  if (existing) {
    return res.status(400).json({ error: "هذا الكتاب موجود بالفاتورة أصلاً — عدّل كميته بدل إضافته" });
  }

  await prisma.purchaseInvoiceItem.create({
    data: { invoiceId, bookId: Number(bookId), quantityExpected: qty, price: priceNum },
  });

  return res.status(200).json({ ok: true });
}
