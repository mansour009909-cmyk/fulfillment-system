import { prisma } from "./prisma";
import { proposeSupplierOrder } from "./supplierDemand";
import { syncStockToSalla } from "./sallaSync";

// يحذف كل عمليات المسح غير المرتبطة بأي فاتورة لكتاب معيّن (تصحيح مسح صار بالغلط) —
// لا يمس أي مخزون أو فاتورة، لأن هذي المسحات أصلًا غير مطابَقة/معتمدة بعد
export async function deleteUnmatchedScans(bookId) {
  const result = await prisma.receivingScan.deleteMany({ where: { bookId, invoiceId: null } });
  return { result: { deleted: result.count } };
}

async function getUnlinkedTally() {
  const tallyRows = await prisma.receivingScan.groupBy({
    by: ["bookId"],
    where: { invoiceId: null },
    _count: { id: true },
  });
  const books = await prisma.book.findMany({ where: { id: { in: tallyRows.map((t) => t.bookId) } } });
  const bookMap = Object.fromEntries(books.map((b) => [b.id, b]));
  return tallyRows.map((t) => ({
    bookId: t.bookId,
    barcode: bookMap[t.bookId].barcode,
    title: bookMap[t.bookId].title,
    quantityScanned: t._count.id,
  }));
}

// راجع قسم 6.2: مسح كل كتاب وصل فعليًا بدون تحديد مورد أو فاتورة مسبقًا
export async function scanReceiving(barcode) {
  if (!barcode) return { error: { status: 400, body: { error: "الباركود مطلوب" } } };

  let book = await prisma.book.findUnique({ where: { barcode } });
  if (!book) {
    book = await prisma.book.create({ data: { barcode, title: `كتاب جديد (${barcode})` } });
  }
  await prisma.receivingScan.create({ data: { bookId: book.id } });

  const tally = await getUnlinkedTally();
  return { result: { book: { title: book.title, barcode: book.barcode }, tally } };
}

// فواتير مسودة (من أي مورد) تشترك بكتاب واحد على الأقل مع الجرد الفعلي غير المرتبط حاليًا
export async function getReconcileCandidates() {
  const unlinkedScans = await prisma.receivingScan.findMany({
    where: { invoiceId: null },
    select: { bookId: true },
    distinct: ["bookId"],
  });
  const bookIds = unlinkedScans.map((s) => s.bookId);

  const candidateInvoices = bookIds.length
    ? await prisma.purchaseInvoice.findMany({
        where: { status: "DRAFT", items: { some: { bookId: { in: bookIds } } } },
        include: { supplier: true, items: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return candidateInvoices.map((inv) => ({
    id: inv.id,
    supplierName: inv.supplier.name,
    itemCount: inv.items.length,
    sharedBookCount: inv.items.filter((i) => bookIds.includes(i.bookId)).length,
  }));
}

// حالة مطابقة فاتورة معيّنة: كل بند (متوقع مقابل ممسوح/مستلم فعليًا) + الرفوف المتاحة لاختيار وجهة التخزين
export async function getInvoiceReconciliation(invoiceId) {
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: invoiceId },
    include: { supplier: true, items: { include: { book: true } } },
  });
  if (!invoice) return null;

  const items = [];
  for (const item of invoice.items) {
    const availableWhere =
      invoice.status === "APPROVED"
        ? { bookId: item.bookId, invoiceId: invoice.id }
        : { bookId: item.bookId, invoiceId: null };
    const available = await prisma.receivingScan.count({ where: availableWhere });
    items.push({
      bookId: item.bookId,
      barcode: item.book.barcode,
      title: item.book.title,
      quantityExpected: item.quantityExpected,
      price: item.price,
      available,
    });
  }

  const shelves = await prisma.shelf.findMany({ orderBy: { sortOrder: "asc" } });

  return {
    invoice: {
      id: invoice.id,
      status: invoice.status,
      type: invoice.type,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplier.name,
      supplierBalance: invoice.supplier.balance,
      createdAt: invoice.createdAt,
      approvedAt: invoice.approvedAt,
      items,
    },
    shelves: shelves.map((s) => ({ id: s.id, name: s.name })),
  };
}

// راجع قسم 6.3: الموظف يملك صلاحية تعديل الكمية المتوقعة لإقفال فروقات الجرد
// employeeId (اختياري): يُسجَّل كـ"فرق جرد" بسجل أداء الموظف (قسم 2.5) — فقط من الجوال
export async function adjustReceivingItem(invoiceId, bookId, quantityExpected, employeeId) {
  const qty = Number(quantityExpected);
  if (!Number.isFinite(qty) || qty < 0) {
    return { error: { status: 400, body: { error: "كمية غير صحيحة" } } };
  }

  const item = await prisma.purchaseInvoiceItem.findFirst({ where: { invoiceId, bookId } });
  if (!item) return { error: { status: 404, body: { error: "هذا الكتاب غير موجود ببنود الفاتورة" } } };

  await prisma.purchaseInvoiceItem.update({ where: { id: item.id }, data: { quantityExpected: qty } });

  if (employeeId && qty !== item.quantityExpected) {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    await prisma.employeeErrorLog.create({
      data: {
        employeeId,
        type: "INVENTORY_DISCREPANCY",
        invoiceId,
        bookId,
        detail: `فرق جرد بفاتورة #${invoiceId} — "${book?.title || bookId}": متوقع ${item.quantityExpected}، عُدِّل إلى ${qty}`,
      },
    });
  }

  return { result: { ok: true } };
}

// راجع قسم 6.3: اعتماد الفاتورة بعد إقفال كل الفروقات — يربط الجرد الفعلي بها،
// يحدّث رصيد المورد المالي، ويضيف الكميات المعتمدة للمخزون المشترك بالرف المختار
export async function approveReceivingInvoice(invoiceId, shelfId) {
  const shelfIdNum = Number(shelfId);

  const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: invoiceId }, include: { items: true } });
  if (!invoice) return { error: { status: 404, body: { error: "الفاتورة غير موجودة" } } };
  if (invoice.status === "APPROVED") return { error: { status: 400, body: { error: "الفاتورة معتمدة مسبقًا" } } };

  const shelf = await prisma.shelf.findUnique({ where: { id: shelfIdNum } });
  if (!shelf) return { error: { status: 400, body: { error: "اختر رفًا صحيحًا لإضافة المخزون" } } };

  for (const item of invoice.items) {
    const available = await prisma.receivingScan.count({ where: { bookId: item.bookId, invoiceId: null } });
    if (available < item.quantityExpected) {
      return {
        error: {
          status: 400,
          body: {
            error: `الكمية الممسوحة غير كافية لهذا البند — لازم تقفل الفرق أولًا (متاح ${available} من ${item.quantityExpected})`,
          },
        },
      };
    }
  }

  const isConsignment = invoice.type === "CONSIGNMENT";
  const stockWhere = (bookId) =>
    isConsignment
      ? { shelfId: shelfIdNum, bookId, ownership: "SUPPLIER", supplierId: invoice.supplierId, clientId: null }
      : { shelfId: shelfIdNum, bookId, ownership: "SHARED", clientId: null, supplierId: null };

  for (const item of invoice.items) {
    const scans = await prisma.receivingScan.findMany({
      where: { bookId: item.bookId, invoiceId: null },
      take: item.quantityExpected,
      orderBy: { scannedAt: "asc" },
    });
    await prisma.receivingScan.updateMany({ where: { id: { in: scans.map((s) => s.id) } }, data: { invoiceId } });

    const existingStock = await prisma.shelfStock.findFirst({ where: stockWhere(item.bookId) });
    if (existingStock) {
      await prisma.shelfStock.update({ where: { id: existingStock.id }, data: { quantity: { increment: item.quantityExpected } } });
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

  if (!isConsignment) {
    await prisma.supplier.update({ where: { id: invoice.supplierId }, data: { balance: { increment: total } } });
  }

  if (!isConsignment) {
    const linkedOrder = await prisma.supplierOrder.findUnique({ where: { purchaseInvoiceId: invoiceId } });
    if (linkedOrder) {
      await proposeSupplierOrder(invoice.supplierId);
    }
  }

  return { result: { ok: true, total } };
}
