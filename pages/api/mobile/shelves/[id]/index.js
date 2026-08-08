import { requireEmployee } from "../../../../../lib/mobileAuth";
import { getShelfDetail, deleteShelf } from "../../../../../lib/shelfInventory";

export default async function handler(req, res) {
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  if (req.method === "GET") {
    const shelf = await getShelfDetail(Number(req.query.id));
    if (!shelf) return res.status(404).json({ error: "الرف غير موجود" });
    return res.status(200).json(shelf);
  }

  if (req.method === "DELETE") {
    const force = req.query.force === "true";
    const { result, error } = await deleteShelf(Number(req.query.id), { force });
    if (error) return res.status(error.status).json(error.body);
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
