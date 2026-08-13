import { approveReceivingInvoice } from "../../../../lib/receiving";

// راجع قسم 6.3: اعتماد الفاتورة بعد إقفال كل الفروقات
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { result, error } = await approveReceivingInvoice(
    Number(req.query.invoiceId),
    req.body.shelfId,
    Boolean(req.body.allowShort)
  );
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
