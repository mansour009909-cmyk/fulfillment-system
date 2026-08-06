import { prisma } from "../../../../lib/prisma";

// راجع قسم 6.3: الموظف يملك صلاحية تعديل الكمية المتوقعة لإقفال فروقات الجرد
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const invoiceId = Number(req.query.invoiceId);
  const { bookId, quantityExpected } = req.body;
  const qty = Number(quantityExpected);

  if (!Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ error: "كمية غير صحيحة" });
  }

  const item = await prisma.purchaseInvoiceItem.findFirst({
    where: { invoiceId, bookId: Number(bookId) },
  });
  if (!item) {
    return res.status(404).json({ error: "هذا الكتاب غير موجود ببنود الفاتورة" });
  }

  await prisma.purchaseInvoiceItem.update({
    where: { id: item.id },
    data: { quantityExpected: qty },
  });

  return res.status(200).json({ ok: true });
}
