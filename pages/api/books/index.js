import { prisma } from "../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { barcode, title } = req.body;

  if (!barcode || !title) {
    return res.status(400).json({ error: "الباركود والعنوان كلاهما مطلوب" });
  }

  const existing = await prisma.book.findUnique({ where: { barcode } });
  if (existing) {
    return res.status(409).json({ error: "هذا الباركود مستخدم لكتاب آخر" });
  }

  const book = await prisma.book.create({ data: { barcode, title } });

  return res.status(201).json({ id: book.id });
}
