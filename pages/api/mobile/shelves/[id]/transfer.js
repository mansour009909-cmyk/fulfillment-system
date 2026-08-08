import { requireEmployee } from "../../../../../lib/mobileAuth";
import { transferStock } from "../../../../../lib/shelfInventory";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const { bookId, toShelfId, quantity } = req.body;
  const { result, error } = await transferStock(
    Number(req.query.id),
    Number(bookId),
    Number(toShelfId),
    quantity
  );
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
