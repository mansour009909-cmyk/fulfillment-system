import { prisma } from "../../../lib/prisma";

// يبحث بالكتب الموجودة (عنوان أو باركود) لتغذية منتقي الصنف بفواتير الشراء
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = (req.query.q || "").trim();
  if (!q) {
    return res.status(200).json({ books: [] });
  }

  const books = await prisma.book.findMany({
    where: {
      OR: [{ title: { contains: q } }, { barcode: { contains: q } }],
    },
    take: 10,
    orderBy: { title: "asc" },
  });

  return res.status(200).json({
    books: books.map((b) => ({ id: b.id, barcode: b.barcode, title: b.title })),
  });
}
