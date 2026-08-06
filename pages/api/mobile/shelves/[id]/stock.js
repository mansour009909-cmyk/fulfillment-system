import { requireEmployee } from "../../../../../lib/mobileAuth";
import { addShelfStock } from "../../../../../lib/shelfInventory";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const { result, error } = await addShelfStock(Number(req.query.id), req.body);
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
