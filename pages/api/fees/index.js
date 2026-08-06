import { prisma } from "../../../lib/prisma";

// ينشئ/يحدّث سعر رسم (عام أو مخصص لعميل)، ويسجّل التغيير بسجل التدقيق
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, clientId, amount } = req.body;
  const amountNum = Number(amount);
  const clientIdNum = clientId ? Number(clientId) : null;

  if (!type || !Number.isFinite(amountNum) || amountNum < 0) {
    return res.status(400).json({ error: "النوع والقيمة مطلوبان (قيمة غير سالبة)" });
  }

  // findFirst بدل findUnique على المفتاح المركّب لأن clientId قد يكون null
  const existing = await prisma.fee.findFirst({ where: { type, clientId: clientIdNum } });

  const oldAmount = existing ? existing.amount : 0;

  if (existing) {
    await prisma.fee.update({ where: { id: existing.id }, data: { amount: amountNum } });
  } else {
    await prisma.fee.create({ data: { type, clientId: clientIdNum, amount: amountNum } });
  }

  await prisma.feeAuditLog.create({
    data: { feeType: type, clientId: clientIdNum, oldAmount, newAmount: amountNum },
  });

  return res.status(200).json({ ok: true });
}
