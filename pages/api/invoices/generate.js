import { prisma } from "../../../lib/prisma";

// يجمع كل الشحنات المكتملة غير المفوترة لعميل معيّن بفاتورة واحدة جديدة
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId } = req.body;
  const clientIdNum = Number(clientId);

  const charges = await prisma.orderCharge.findMany({
    where: { clientId: clientIdNum, invoiced: false },
    orderBy: { createdAt: "asc" },
  });

  if (charges.length === 0) {
    return res.status(400).json({ error: "لا توجد شحنات مكتملة غير مفوترة لهذا العميل" });
  }

  const total = charges.reduce(
    (sum, c) => sum + c.fulfillmentFee + c.labelFee + c.shippingFee + c.packagingFee,
    0
  );
  const periodStart = charges[0].createdAt;
  const periodEnd = charges[charges.length - 1].createdAt;

  const invoice = await prisma.clientInvoice.create({
    data: {
      clientId: clientIdNum,
      periodStart,
      periodEnd,
      total,
    },
  });

  await prisma.orderCharge.updateMany({
    where: { id: { in: charges.map((c) => c.id) } },
    data: { invoiced: true, invoiceId: invoice.id },
  });

  return res.status(200).json({ invoiceId: invoice.id, total, chargeCount: charges.length });
}
