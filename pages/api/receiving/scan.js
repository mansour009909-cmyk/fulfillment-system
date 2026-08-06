import { prisma } from "../../../lib/prisma";

// راجع قسم 6.2: مسح كل كتاب وصل فعليًا بدون تحديد مورد أو فاتورة مسبقًا
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { barcode } = req.body;
  if (!barcode) {
    return res.status(400).json({ error: "الباركود مطلوب" });
  }

  let book = await prisma.book.findUnique({ where: { barcode } });
  if (!book) {
    book = await prisma.book.create({
      data: { barcode, title: `كتاب جديد (${barcode})` },
    });
  }

  await prisma.receivingScan.create({ data: { bookId: book.id } });

  const tallyRows = await prisma.receivingScan.groupBy({
    by: ["bookId"],
    where: { invoiceId: null },
    _count: { id: true },
  });

  const books = await prisma.book.findMany({
    where: { id: { in: tallyRows.map((t) => t.bookId) } },
  });
  const bookMap = Object.fromEntries(books.map((b) => [b.id, b]));

  const tally = tallyRows.map((t) => ({
    bookId: t.bookId,
    barcode: bookMap[t.bookId].barcode,
    title: bookMap[t.bookId].title,
    quantityScanned: t._count.id,
  }));

  return res.status(200).json({
    book: { title: book.title, barcode: book.barcode },
    tally,
  });
}
