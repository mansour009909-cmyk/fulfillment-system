import { prisma } from "../../../lib/prisma";

// إنشاء طلب عميل يدويًا — بديل مؤقت لسحب الطلبات تلقائيًا من سلة (غير مفعّل بعد)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { orderNumber, clientId, items } = req.body;
  const cleanOrderNumber = (orderNumber || "").trim();
  const clientIdNum = Number(clientId);

  if (!cleanOrderNumber) return res.status(400).json({ error: "رقم الطلب مطلوب" });
  if (!clientIdNum) return res.status(400).json({ error: "لازم تختار عميل" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "لازم بند واحد على الأقل" });
  }

  const client = await prisma.client.findUnique({ where: { id: clientIdNum } });
  if (!client) return res.status(400).json({ error: "العميل غير موجود" });

  const existing = await prisma.order.findUnique({ where: { orderNumber: cleanOrderNumber } });
  if (existing) return res.status(409).json({ error: "رقم الطلب هذا مستخدَم بطلب آخر" });

  const itemsData = [];
  for (const item of items) {
    const qty = Number(item.quantityRequired);
    if (!item.bookId || !Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ error: "بيانات غير صحيحة لأحد البنود" });
    }
    itemsData.push({ bookId: Number(item.bookId), quantityRequired: qty });
  }

  const order = await prisma.order.create({
    data: { orderNumber: cleanOrderNumber, clientId: clientIdNum, items: { create: itemsData } },
  });

  return res.status(201).json({ id: order.id });
}
