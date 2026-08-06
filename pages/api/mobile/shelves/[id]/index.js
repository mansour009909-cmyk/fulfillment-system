import { requireEmployee } from "../../../../../lib/mobileAuth";
import { getShelfDetail } from "../../../../../lib/shelfInventory";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const shelf = await getShelfDetail(Number(req.query.id));
  if (!shelf) return res.status(404).json({ error: "الرف غير موجود" });
  return res.status(200).json(shelf);
}
