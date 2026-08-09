import { deleteInvoiceItem } from "../../../../lib/purchaseInvoice";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { bookId } = req.body;
  if (!bookId) return res.status(400).json({ error: "bookId مطلوب" });

  const { result, error } = await deleteInvoiceItem(Number(req.query.invoiceId), Number(bookId));
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
