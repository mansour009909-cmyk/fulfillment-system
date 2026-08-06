import { prisma } from "../../../../lib/prisma";

// إضافة وحدة/رسوم تخزين دورية لمورد (قسم 7.1 و7.2)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supplierId = Number(req.query.id);
  const { label, feePerPeriod, notes } = req.body;
  const fee = Number(feePerPeriod);

  if (!label) {
    return res.status(400).json({ error: "وصف الوحدة مطلوب" });
  }
  if (!Number.isFinite(fee) || fee < 0) {
    return res.status(400).json({ error: "رسوم غير صحيحة" });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    return res.status(404).json({ error: "المورد غير موجود" });
  }

  const unit = await prisma.supplierStorageUnit.create({
    data: { supplierId, label, feePerPeriod: fee, notes: notes || null },
  });

  return res.status(201).json({ id: unit.id });
}
