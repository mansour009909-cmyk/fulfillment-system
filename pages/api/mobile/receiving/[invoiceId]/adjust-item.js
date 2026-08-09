import { requireEmployee } from "../../../../../lib/mobileAuth";
import { adjustReceivingItem } from "../../../../../lib/receiving";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const { bookId, quantityExpected } = req.body;
  const { result, error } = await adjustReceivingItem(
    Number(req.query.invoiceId),
    Number(bookId),
    quantityExpected,
    employee.id
  );
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
