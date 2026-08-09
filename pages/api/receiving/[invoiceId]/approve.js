import { prisma } from "../../../../lib/prisma";
import { proposeSupplierOrder } from "../../../../lib/supplierDemand";
import { syncStockToSalla } from "../../../../lib/sallaSync";

// راجع قسم 6.3: اعتماد الفاتورة بعد إقفال كل الفروقات — يربط الجرد الفعلي بها،
// يحدّث رصيد المورد المالي، ويضيف الكميات المعتمدة للمخزون المشترك بالرف المختار
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const invoiceId = Number(req.query.invoiceId);
  const { shelfId } = req.body;
  const shelfIdNum = Number(shelfId);

  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: invoiceId },
    include: { items: true },
  });
  if (!invoice) {
    return res.status(404).json({ error: "الفاتورة غير موجودة" });
  }
  if (invoice.status === "APPROVED") {
    return res.status(400).json({ error: "الفاتورة معتمدة مسبقًا" });
  }

  const shelf = await prisma.shelf.findUnique({ where: { id: shelfIdNum } });
  if (!shelf) {
    return res.status(400).json({ error: "اختر رفًا صحيحًا لإضافة المخزون" });
  }

  // تحقق أن كل بند عنده جرد كافٍ (غير مرتبط) قبل الاعتماد
  for (const item of invoice.items) {
    const available = await prisma.receivingScan.count({
      where: { bookId: item.bookId, invoiceId: null },
    });
    if (available < item.quantityExpected) {
      return res.status(400).json({
        error: `الكمية الممسوحة غير كافية لهذا البند — لازم تقفل الفرق أولًا (متاح ${available} من ${item.quantityExpected})`,
      });
    }
  }

  const isConsignment = invoice.type === "CONSIGNMENT";
  const stockWhere = (bookId) =>
    isConsignment
      ? { shelfId: shelfIdNum, bookId, ownership: "SUPPLIER", supplierId: invoice.supplierId, clientId: null }
      : { shelfId: shelfIdNum, bookId, ownership: "SHARED", clientId: null, supplierId: null };

  // اربط الجرد الفعلي بالفاتورة، وحدّث المخزون، لكل بند
  for (const item of invoice.items) {
    const scans = await prisma.receivingScan.findMany({
      where: { bookId: item.bookId, invoiceId: null },
      take: item.quantityExpected,
      orderBy: { scannedAt: "asc" },
    });
    await prisma.receivingScan.updateMany({
      where: { id: { in: scans.map((s) => s.id) } },
      data: { invoiceId },
    });

    const existingStock = await prisma.shelfStock.findFirst({ where: stockWhere(item.bookId) });
    if (existingStock) {
      await prisma.shelfStock.update({
        where: { id: existingStock.id },
        data: { quantity: { increment: item.quantityExpected } },
      });
    } else {
      await prisma.shelfStock.create({
        data: {
          shelfId: shelfIdNum,
          bookId: item.bookId,
          quantity: item.quantityExpected,
          ownership: isConsignment ? "SUPPLIER" : "SHARED",
          supplierId: isConsignment ? invoice.supplierId : null,
        },
      });
    }
  }

  if (!isConsignment) {
    for (const item of invoice.items) {
      syncStockToSalla(item.bookId).catch(() => {});
    }
  }

  const total = invoice.items.reduce((sum, i) => sum + i.quantityExpected * i.price, 0);

  await prisma.purchaseInvoice.update({
    where: { id: invoiceId },
    data: { status: "APPROVED", approvedAt: new Date(), shelfId: shelfIdNum },
  });

  // تخزين بغرض البيع (CONSIGNMENT): المخزون يبقى ملك المورد — ما اشترينا شيء، فما يزيد رصيده هنا
  if (!isConsignment) {
    await prisma.supplier.update({
      where: { id: invoice.supplierId },
      data: { balance: { increment: total } },
    });
  }

  // محفّز الدورة الجديدة (قسم 8.5): لو الفاتورة جاية من طلبية آلية، ابدأ اقتراح الدورة التالية تلقائيًا
  if (!isConsignment) {
    const linkedOrder = await prisma.supplierOrder.findUnique({ where: { purchaseInvoiceId: invoiceId } });
    if (linkedOrder) {
      await proposeSupplierOrder(invoice.supplierId);
    }
  }

  return res.status(200).json({ ok: true, total });
}
