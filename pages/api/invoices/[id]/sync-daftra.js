import { prisma } from "../../../../lib/prisma";
import { getIntegration } from "../../../../lib/integrations";
import { createDaftraInvoice } from "../../../../lib/daftra";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const invoiceId = Number(req.query.id);
  const invoice = await prisma.clientInvoice.findUnique({ where: { id: invoiceId }, include: { client: true } });
  if (!invoice) return res.status(404).json({ error: "الفاتورة غير موجودة" });

  const integration = await getIntegration("DAFTRA");

  try {
    const { daftraInvoiceId } = await createDaftraInvoice(integration, { clientInvoice: invoice, client: invoice.client });
    await prisma.clientInvoice.update({
      where: { id: invoiceId },
      data: { daftraInvoiceId, daftraSyncedAt: new Date(), daftraSyncError: null },
    });
    return res.status(200).json({ ok: true, daftraInvoiceId });
  } catch (err) {
    await prisma.clientInvoice.update({ where: { id: invoiceId }, data: { daftraSyncError: err.message } });
    return res.status(400).json({ error: err.message });
  }
}
