import { prisma } from "../../../../../lib/prisma";

// يعدّل بنود فاتورة مسودة كاملة (يحذف القديمة وينشئ الجديدة) — مسموح فقط قبل الاعتماد
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const invoiceId = Number(req.query.invoiceId);
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "لازم بند واحد على الأقل" });
  }

  const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return res.status(404).json({ error: "الفاتورة غير موجودة" });
  }
  if (invoice.status === "APPROVED") {
    return res.status(400).json({ error: "لا يمكن تعديل فاتورة معتمدة" });
  }

  const itemsData = [];
  for (const item of items) {
    const qty = Number(item.quantityExpected);
    const price = Number(item.price);
    if (!item.barcode || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: `بيانات غير صحيحة للبند: ${item.barcode || "بدون باركود"}` });
    }

    let book = await prisma.book.findUnique({ where: { barcode: item.barcode } });
    if (!book) {
      if (!item.title) {
        return res.status(400).json({ error: `الباركود ${item.barcode} جديد — لازم تدخل عنوان الكتاب` });
      }
      book = await prisma.book.create({ data: { barcode: item.barcode, title: item.title } });
    }

    itemsData.push({ bookId: book.id, quantityExpected: qty, price });
  }

  await prisma.purchaseInvoiceItem.deleteMany({ where: { invoiceId } });
  await prisma.purchaseInvoiceItem.createMany({
    data: itemsData.map((i) => ({ ...i, invoiceId })),
  });

  return res.status(200).json({ ok: true });
}
