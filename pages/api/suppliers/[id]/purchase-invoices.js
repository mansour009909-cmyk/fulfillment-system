import { prisma } from "../../../../lib/prisma";

// راجع قسم 6.1: إنشاء فاتورة شراء مسودة داخل النظام (بدون ربط بمحاسبة خارجية)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supplierId = Number(req.query.id);
  const { items, type } = req.body; // [{ barcode, title, quantityExpected, price }]
  const invoiceType = type === "CONSIGNMENT" ? "CONSIGNMENT" : "PURCHASE";

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "لازم تضيف بند واحد على الأقل" });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    return res.status(404).json({ error: "المورد غير موجود" });
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

  const invoice = await prisma.purchaseInvoice.create({
    data: { supplierId, type: invoiceType, items: { create: itemsData } },
  });

  return res.status(201).json({ id: invoice.id });
}
