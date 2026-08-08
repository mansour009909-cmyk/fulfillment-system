import { requireEmployee } from "../../../../lib/mobileAuth";
import { prisma } from "../../../../lib/prisma";
import { updateBook } from "../../../../lib/bookCatalog";

export default async function handler(req, res) {
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  if (req.method === "GET") {
    const book = await prisma.book.findUnique({
      where: { id: Number(req.query.id) },
      include: { shelfStock: { where: { ownership: "SHARED", clientId: null }, include: { shelf: true } } },
    });
    if (!book) return res.status(404).json({ error: "الكتاب غير موجود" });
    return res.status(200).json({
      ...book,
      totalQty: book.shelfStock.reduce((sum, s) => sum + s.quantity, 0),
      stockByShelf: book.shelfStock.map((s) => ({ shelfId: s.shelfId, shelfName: s.shelf.name, quantity: s.quantity })),
    });
  }

  if (req.method === "PATCH") {
    const { result, error } = await updateBook(Number(req.query.id), req.body);
    if (error) return res.status(error.status).json(error.body);
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
