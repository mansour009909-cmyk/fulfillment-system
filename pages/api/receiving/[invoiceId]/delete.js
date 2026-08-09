import { deleteInvoice } from "../../../../lib/purchaseInvoice";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { result, error } = await deleteInvoice(Number(req.query.invoiceId));
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
