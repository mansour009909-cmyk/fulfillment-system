import { prisma } from "./prisma";

// طبقة منطق مشتركة لإدارة الرفوف/المخزون — تُستخدم من الويب (pages/api/shelves/**)
// ومن الجوال (pages/api/mobile/shelves/**) بدون تكرار الكود.

export async function listShelves() {
  const shelves = await prisma.shelf.findMany({
    orderBy: { sortOrder: "asc" },
    include: { stock: { where: { ownership: "SHARED", clientId: null } } },
  });
  return shelves.map((s) => ({
    id: s.id,
    barcode: s.barcode,
    name: s.name,
    sortOrder: s.sortOrder,
    titleCount: s.stock.length,
    totalQuantity: s.stock.reduce((sum, st) => sum + st.quantity, 0),
  }));
}

export async function createShelf({ barcode, name, sortOrder }) {
  if (!barcode || !name || !sortOrder) {
    return { error: { status: 400, body: { error: "الباركود والاسم وترتيب اللقط كلها مطلوبة" } } };
  }
  const sortOrderNum = Number(sortOrder);
  if (!Number.isInteger(sortOrderNum) || sortOrderNum < 1) {
    return { error: { status: 400, body: { error: "ترتيب اللقط لازم يكون رقم صحيح أكبر من صفر" } } };
  }

  const [barcodeTaken, sortOrderTaken] = await Promise.all([
    prisma.shelf.findUnique({ where: { barcode } }),
    prisma.shelf.findUnique({ where: { sortOrder: sortOrderNum } }),
  ]);
  if (barcodeTaken) return { error: { status: 409, body: { error: "هذا الباركود مستخدم برف آخر" } } };
  if (sortOrderTaken) return { error: { status: 409, body: { error: "ترتيب اللقط هذا مستخدم برف آخر" } } };

  const shelf = await prisma.shelf.create({ data: { barcode, name, sortOrder: sortOrderNum } });
  return { result: { id: shelf.id } };
}

export async function getShelfDetail(shelfId) {
  const shelf = await prisma.shelf.findUnique({
    where: { id: shelfId },
    include: { stock: { where: { ownership: "SHARED", clientId: null }, include: { book: true } } },
  });
  if (!shelf) return null;

  return {
    id: shelf.id,
    barcode: shelf.barcode,
    name: shelf.name,
    sortOrder: shelf.sortOrder,
    stock: shelf.stock.map((s) => ({
      bookId: s.bookId,
      title: s.book.title,
      barcode: s.book.barcode,
      imageUrl: s.book.imageUrl,
      brandName: s.book.brandName,
      quantity: s.quantity,
    })),
  };
}

// force=true يتجاوز فحص وجود مخزون ويحذف الرف مع أي كمية متبقية فيه (يُفقد تتبّعها بالنظام
// نهائيًا — لا يحذف الكتب نفسها من الكتالوج، فقط سجل وجودها بهذا الرف تحديدًا)
export async function deleteShelf(shelfId, { force = false } = {}) {
  const shelf = await prisma.shelf.findUnique({ where: { id: shelfId }, include: { stock: true } });
  if (!shelf) return { error: { status: 404, body: { error: "الرف غير موجود" } } };

  const hasStock = shelf.stock.some((s) => s.quantity > 0);
  if (hasStock && !force) {
    return {
      error: {
        status: 409,
        body: {
          error: "لا يمكن حذف رف فيه مخزون — انقل الكميات لرف آخر، أو احذف الرف بالقوة (يُفقد تتبّع الكمية)",
          hasStock: true,
        },
      },
    };
  }

  try {
    await prisma.shelfStock.deleteMany({ where: { shelfId } });
    await prisma.shelfScanLog.deleteMany({ where: { shelfId } });
    await prisma.shelf.delete({ where: { id: shelfId } });
    // يقفل الفجوة بترتيب اللقط: أي رف كان ترتيبه بعد الرف المحذوف يتراجع بمقدار 1
    await prisma.shelf.updateMany({
      where: { sortOrder: { gt: shelf.sortOrder } },
      data: { sortOrder: { decrement: 1 } },
    });
  } catch {
    return {
      error: {
        status: 409,
        body: { error: "لا يمكن حذف هذا الرف — مرتبط بفواتير شراء سابقة (استلام مخزون منه من قبل)" },
      },
    };
  }

  return { result: { ok: true } };
}

// يزيل كتاب من رف بالكامل (يحذف صف ShelfStock نهائيًا — للتصحيح اليدوي، مو للبيع الفعلي)
export async function removeBookFromShelf(shelfId, bookId) {
  const stock = await prisma.shelfStock.findFirst({
    where: { shelfId, bookId, ownership: "SHARED", clientId: null },
  });
  if (!stock) return { error: { status: 404, body: { error: "هذا الكتاب غير موجود بهذا الرف" } } };

  await prisma.shelfStock.delete({ where: { id: stock.id } });
  return { result: { ok: true } };
}

// ينقل كمية من كتاب من رف لرف آخر (تصحيح/إعادة تنظيم — لا يغيّر إجمالي المخزون بالنظام)
export async function transferStock(fromShelfId, bookId, toShelfId, quantity) {
  const quantityNum = Number(quantity);
  if (!Number.isInteger(quantityNum) || quantityNum < 1) {
    return { error: { status: 400, body: { error: "الكمية لازم تكون رقم صحيح أكبر من صفر" } } };
  }
  if (fromShelfId === toShelfId) {
    return { error: { status: 400, body: { error: "لازم تختار رف مختلف عن الرف الحالي" } } };
  }

  const [fromStock, toShelf] = await Promise.all([
    prisma.shelfStock.findFirst({ where: { shelfId: fromShelfId, bookId, ownership: "SHARED", clientId: null } }),
    prisma.shelf.findUnique({ where: { id: toShelfId } }),
  ]);
  if (!fromStock || fromStock.quantity < quantityNum) {
    return { error: { status: 400, body: { error: "الكمية المطلوب نقلها أكبر من المتوفر بالرف الحالي" } } };
  }
  if (!toShelf) return { error: { status: 404, body: { error: "الرف الهدف غير موجود" } } };

  const toStock = await prisma.shelfStock.findFirst({
    where: { shelfId: toShelfId, bookId, ownership: "SHARED", clientId: null },
  });

  if (fromStock.quantity === quantityNum) {
    await prisma.shelfStock.delete({ where: { id: fromStock.id } });
  } else {
    await prisma.shelfStock.update({ where: { id: fromStock.id }, data: { quantity: { decrement: quantityNum } } });
  }

  if (toStock) {
    await prisma.shelfStock.update({ where: { id: toStock.id }, data: { quantity: { increment: quantityNum } } });
  } else {
    await prisma.shelfStock.create({ data: { shelfId: toShelfId, bookId, quantity: quantityNum } });
  }

  return { result: { ok: true } };
}

// راجع قسم 3.2: كل مسح باركود يزيد كمية الكتاب بذلك الرف بمقدار 1
export async function scanShelfBook(shelfId, barcode) {
  if (!barcode) return { error: { status: 400, body: { error: "الباركود مطلوب" } } };

  const shelf = await prisma.shelf.findUnique({ where: { id: shelfId } });
  if (!shelf) return { error: { status: 404, body: { error: "الرف غير موجود" } } };

  let book = await prisma.book.findUnique({ where: { barcode } });
  if (!book) {
    book = await prisma.book.create({ data: { barcode, title: `كتاب جديد (${barcode})` } });
  }

  const existing = await prisma.shelfStock.findFirst({
    where: { shelfId: shelf.id, bookId: book.id, ownership: "SHARED", clientId: null },
  });
  const updated = existing
    ? await prisma.shelfStock.update({ where: { id: existing.id }, data: { quantity: { increment: 1 } } })
    : await prisma.shelfStock.create({ data: { shelfId: shelf.id, bookId: book.id, quantity: 1 } });

  await prisma.shelfScanLog.create({ data: { shelfId: shelf.id, bookBarcode: barcode, quantityDelta: 1 } });

  return {
    result: {
      bookId: book.id,
      book: { title: book.title, barcode: book.barcode, imageUrl: book.imageUrl, brandName: book.brandName },
      quantity: updated.quantity,
    },
  };
}

// إضافة كتاب لرف بكمية مباشرة (إدخال يدوي بدفعة واحدة، وليس مسح متتابع)
export async function addShelfStock(shelfId, { barcode, title, quantity }) {
  const quantityNum = Number(quantity);
  if (!barcode) return { error: { status: 400, body: { error: "الباركود مطلوب" } } };
  if (!Number.isInteger(quantityNum) || quantityNum < 1) {
    return { error: { status: 400, body: { error: "الكمية لازم تكون رقم صحيح أكبر من صفر" } } };
  }

  const shelf = await prisma.shelf.findUnique({ where: { id: shelfId } });
  if (!shelf) return { error: { status: 404, body: { error: "الرف غير موجود" } } };

  let book = await prisma.book.findUnique({ where: { barcode } });
  if (!book) {
    if (!title) return { error: { status: 400, body: { error: "هذا الباركود جديد — لازم تدخل عنوان الكتاب" } } };
    book = await prisma.book.create({ data: { barcode, title } });
  }

  const existing = await prisma.shelfStock.findFirst({
    where: { shelfId: shelf.id, bookId: book.id, ownership: "SHARED", clientId: null },
  });
  const updated = existing
    ? await prisma.shelfStock.update({ where: { id: existing.id }, data: { quantity: { increment: quantityNum } } })
    : await prisma.shelfStock.create({ data: { shelfId: shelf.id, bookId: book.id, quantity: quantityNum } });

  return {
    result: {
      bookId: book.id,
      book: { title: book.title, barcode: book.barcode, imageUrl: book.imageUrl, brandName: book.brandName },
      quantity: updated.quantity,
    },
  };
}
