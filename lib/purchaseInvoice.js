import { prisma } from "./prisma";

function stockWhereFor(invoice, bookId) {
  return invoice.type === "CONSIGNMENT"
    ? { shelfId: invoice.shelfId, bookId, ownership: "SUPPLIER", supplierId: invoice.supplierId, clientId: null }
    : { shelfId: invoice.shelfId, bookId, ownership: "SHARED", clientId: null, supplierId: null };
}

// يحذف بند واحد من فاتورة (مسودة أو معتمدة) — مثلاً كتاب تم تأكيد استلامه بالغلط.
// لو الفاتورة معتمدة: يعكس أثره على المخزون ورصيد المورد أولًا (يرفض الحذف لو جزء من
// المخزون المقابل تم صرفه فعليًا بدل حذف جزئي)، ويحرر سجلات المسح المرتبطة به للمطابقة لاحقًا.
export async function deleteInvoiceItem(invoiceId, bookId) {
  const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { error: { status: 404, body: { error: "الفاتورة غير موجودة" } } };

  const item = await prisma.purchaseInvoiceItem.findFirst({ where: { invoiceId, bookId } });
  if (!item) return { error: { status: 404, body: { error: "هذا الكتاب غير موجود بالفاتورة" } } };

  if (invoice.status === "APPROVED") {
    if (!invoice.shelfId) {
      return { error: { status: 400, body: { error: "الفاتورة معتمدة بدون رف مسجَّل — عدّلها أولًا لتحديد الرف" } } };
    }

    const stock = await prisma.shelfStock.findFirst({ where: stockWhereFor(invoice, bookId) });
    const available = stock ? stock.quantity : 0;
    if (available < item.quantityExpected) {
      const book = await prisma.book.findUnique({ where: { id: bookId } });
      return {
        error: {
          status: 400,
          body: {
            error: `لا يمكن حذف "${book?.title || bookId}" — المخزون المتوفر بالرف حاليًا ${available} فقط (جزء منه تم صرفه بالفعل)`,
          },
        },
      };
    }

    await prisma.shelfStock.update({
      where: { id: stock.id },
      data: { quantity: { decrement: item.quantityExpected } },
    });

    if (invoice.type !== "CONSIGNMENT") {
      await prisma.supplier.update({
        where: { id: invoice.supplierId },
        data: { balance: { decrement: item.quantityExpected * item.price } },
      });
    }

    const linkedScans = await prisma.receivingScan.findMany({
      where: { invoiceId, bookId },
      take: item.quantityExpected,
    });
    await prisma.receivingScan.updateMany({
      where: { id: { in: linkedScans.map((s) => s.id) } },
      data: { invoiceId: null },
    });
  }

  await prisma.purchaseInvoiceItem.delete({ where: { id: item.id } });
  return { result: { ok: true } };
}

// يحذف فاتورة كاملة (مسودة أو معتمدة). لو معتمدة: يعكس أثر كل بند أولًا (نفس منطق حذف
// البند)، ويرفض الحذف بالكامل لو أي بند فيه مخزون مصروف جزئيًا — بدون أي حذف جزئي.
export async function deleteInvoice(invoiceId) {
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, supplierOrder: true },
  });
  if (!invoice) return { error: { status: 404, body: { error: "الفاتورة غير موجودة" } } };

  if (invoice.status === "APPROVED" && invoice.items.length > 0) {
    if (!invoice.shelfId) {
      return { error: { status: 400, body: { error: "الفاتورة معتمدة بدون رف مسجَّل — عدّلها أولًا لتحديد الرف قبل الحذف" } } };
    }

    for (const item of invoice.items) {
      const stock = await prisma.shelfStock.findFirst({ where: stockWhereFor(invoice, item.bookId) });
      const available = stock ? stock.quantity : 0;
      if (available < item.quantityExpected) {
        const book = await prisma.book.findUnique({ where: { id: item.bookId } });
        return {
          error: {
            status: 400,
            body: {
              error: `لا يمكن حذف الفاتورة — "${book?.title || item.bookId}" تم صرف جزء من مخزونه بالفعل (متوفر ${available} فقط)`,
            },
          },
        };
      }
    }

    let balanceDelta = 0;
    for (const item of invoice.items) {
      const stock = await prisma.shelfStock.findFirst({ where: stockWhereFor(invoice, item.bookId) });
      if (stock) {
        await prisma.shelfStock.update({ where: { id: stock.id }, data: { quantity: { decrement: item.quantityExpected } } });
      }
      if (invoice.type !== "CONSIGNMENT") balanceDelta += item.quantityExpected * item.price;
    }
    if (balanceDelta !== 0) {
      await prisma.supplier.update({ where: { id: invoice.supplierId }, data: { balance: { decrement: balanceDelta } } });
    }

    await prisma.receivingScan.updateMany({ where: { invoiceId }, data: { invoiceId: null } });
  }

  if (invoice.supplierOrder) {
    await prisma.supplierOrder.update({ where: { id: invoice.supplierOrder.id }, data: { purchaseInvoiceId: null } });
  }

  await prisma.purchaseInvoiceItem.deleteMany({ where: { invoiceId } });
  await prisma.purchaseInvoice.delete({ where: { id: invoiceId } });

  return { result: { ok: true } };
}
