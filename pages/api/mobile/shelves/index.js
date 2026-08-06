import { requireEmployee } from "../../../../lib/mobileAuth";
import { listShelves, createShelf } from "../../../../lib/shelfInventory";

export default async function handler(req, res) {
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  if (req.method === "GET") {
    const shelves = await listShelves();
    return res.status(200).json({ shelves });
  }

  if (req.method === "POST") {
    const { result, error } = await createShelf(req.body);
    if (error) return res.status(error.status).json(error.body);
    return res.status(201).json(result);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
