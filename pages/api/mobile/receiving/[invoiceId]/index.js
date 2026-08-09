import { requireEmployee } from "../../../../../lib/mobileAuth";
import { getInvoiceReconciliation } from "../../../../../lib/receiving";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const data = await getInvoiceReconciliation(Number(req.query.invoiceId));
  if (!data) return res.status(404).json({ error: "الفاتورة غير موجودة" });
  return res.status(200).json(data);
}
