import { prisma } from "../../../../lib/prisma";

// تعديل بيانات المورد الأساسية + تصنيفه (قسم 8.3 و8.4)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supplierId = Number(req.query.id);
  const { name, importance, location, salesPeriodDays } = req.body;
  const periodDays = Number(salesPeriodDays);

  if (!name) {
    return res.status(400).json({ error: "اسم المورد مطلوب" });
  }
  if (!["IMPORTANT", "NORMAL"].includes(importance)) {
    return res.status(400).json({ error: "تصنيف أهمية غير صحيح" });
  }
  if (!["DOMESTIC", "INTERNATIONAL"].includes(location)) {
    return res.status(400).json({ error: "موقع جغرافي غير صحيح" });
  }
  if (!Number.isFinite(periodDays) || periodDays < 1) {
    return res.status(400).json({ error: "فترة حساب المبيعات غير صحيحة" });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    return res.status(404).json({ error: "المورد غير موجود" });
  }

  await prisma.supplier.update({
    where: { id: supplierId },
    data: { name, importance, location, salesPeriodDays: periodDays },
  });

  return res.status(200).json({ ok: true });
}
