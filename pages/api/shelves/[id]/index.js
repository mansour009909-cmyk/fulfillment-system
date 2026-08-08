import { deleteShelf } from "../../../../lib/shelfInventory";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { result, error } = await deleteShelf(Number(req.query.id));
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
