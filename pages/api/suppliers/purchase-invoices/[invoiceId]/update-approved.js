import { prisma } from "../../../../../lib/prisma";

// تعديل حر لفاتورة معتمدة (كمية/سعر/إضافة/حذف بند) — يصحّح المخزون ورصيد المورد مباشرة
// بالفرق بين القديم والجديد. يرفض أي تعديل يخلي ShelfStock يصير سالب (المخزون المقابل
// تم صرفه فعليًا)، بدون أي كتابة جزئية لقاعدة البيانات.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const invoiceId = Number(req.query.invoiceId);
  const { items, shelfId } = req.body;
  const shelfIdNum = Number(shelfId);

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "لازم بند واحد على الأقل" });
  }

  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: invoiceId },
    include: { items: true },
  });
  if (!invoice) {
    return res.status(404).json({ error: "الفاتورة غير موجودة" });
  }
  if (invoice.status !== "APPROVED") {
    return res.status(400).json({ error: "هذا المسار خاص بالفواتير المعتمدة فقط" });
  }

  const shelf = await prisma.shelf.findUnique({ where: { id: shelfIdNum } });
  if (!shelf) {
    return res.status(400).json({ error: "اختر رفًا صحيحًا" });
  }

  // بناء قائمة البنود الجديدة (بحث عن الكتاب أو إنشاؤه — نفس نمط update.js)
  const newItemsByBook = new Map();
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

    newItemsByBook.set(book.id, { bookId: book.id, quantityExpected: qty, price });
  }

  const oldItemsByBook = new Map(invoice.items.map((i) => [i.bookId, i]));
  const allBookIds = new Set([...oldItemsByBook.keys(), ...newItemsByBook.keys()]);

  const isConsignment = invoice.type === "CONSIGNMENT";
  const stockWhere = (bookId) =>
    isConsignment
      ? { shelfId: shelfIdNum, bookId, ownership: "SUPPLIER", supplierId: invoice.supplierId, clientId: null }
      : { shelfId: shelfIdNum, bookId, ownership: "SHARED", clientId: null, supplierId: null };

  // تحقق أولًا (بدون أي كتابة): أي تقليل بالكمية يحتاج مخزون كافٍ بالرف
  const deltas = [];
  for (const bookId of allBookIds) {
    const oldItem = oldItemsByBook.get(bookId);
    const newItem = newItemsByBook.get(bookId);
    const oldQty = oldItem ? oldItem.quantityExpected : 0;
    const oldPrice = oldItem ? oldItem.price : 0;
    const newQty = newItem ? newItem.quantityExpected : 0;
    const newPrice = newItem ? newItem.price : 0;
    const qtyDelta = newQty - oldQty;

    if (qtyDelta < 0) {
      const stock = await prisma.shelfStock.findFirst({ where: stockWhere(bookId) });
      const available = stock ? stock.quantity : 0;
      if (available < -qtyDelta) {
        const book = await prisma.book.findUnique({ where: { id: bookId } });
        return res.status(400).json({
          error: `لا يمكن تقليل كمية "${book?.title || bookId}" — المخزون المتوفر بالرف حاليًا ${available} فقط (جزء منه تم صرفه بالفعل)`,
        });
      }
    }

    deltas.push({ bookId, oldQty, oldPrice, newQty, newPrice, qtyDelta });
  }

  // كل الفحوصات نجحت — تطبيق التغييرات
  let balanceDelta = 0;
  for (const d of deltas) {
    balanceDelta += d.newQty * d.newPrice - d.oldQty * d.oldPrice;

    if (d.qtyDelta !== 0) {
      const stock = await prisma.shelfStock.findFirst({ where: stockWhere(d.bookId) });
      if (stock) {
        await prisma.shelfStock.update({
          where: { id: stock.id },
          data: { quantity: { increment: d.qtyDelta } },
        });
      } else {
        await prisma.shelfStock.create({
          data: {
            shelfId: shelfIdNum,
            bookId: d.bookId,
            quantity: d.qtyDelta,
            ownership: isConsignment ? "SUPPLIER" : "SHARED",
            supplierId: isConsignment ? invoice.supplierId : null,
          },
        });
      }
    }

    const existingItem = oldItemsByBook.get(d.bookId);
    if (d.newQty === 0) {
      if (existingItem) {
        await prisma.purchaseInvoiceItem.delete({ where: { id: existingItem.id } });
      }
    } else if (existingItem) {
      await prisma.purchaseInvoiceItem.update({
        where: { id: existingItem.id },
        data: { quantityExpected: d.newQty, price: d.newPrice },
      });
    } else {
      await prisma.purchaseInvoiceItem.create({
        data: { invoiceId, bookId: d.bookId, quantityExpected: d.newQty, price: d.newPrice },
      });
    }
  }

  await prisma.purchaseInvoice.update({
    where: { id: invoiceId },
    data: { shelfId: shelfIdNum },
  });
  // تخزين بغرض البيع (CONSIGNMENT): المخزون ملك المورد — لا يؤثر تعديل الكمية/السعر على رصيده
  if (!isConsignment && balanceDelta !== 0) {
    await prisma.supplier.update({
      where: { id: invoice.supplierId },
      data: { balance: { increment: balanceDelta } },
    });
  }

  return res.status(200).json({ ok: true });
}
