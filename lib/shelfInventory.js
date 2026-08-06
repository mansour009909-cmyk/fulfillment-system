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
      quantity: s.quantity,
    })),
  };
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

  return { result: { bookId: book.id, book: { title: book.title, barcode: book.barcode }, quantity: updated.quantity } };
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

  return { result: { bookId: book.id, book: { title: book.title, barcode: book.barcode }, quantity: updated.quantity } };
}
