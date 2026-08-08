import { requireEmployee } from "../../../../../../lib/mobileAuth";
import { removeBookFromShelf } from "../../../../../../lib/shelfInventory";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const { result, error } = await removeBookFromShelf(Number(req.query.id), Number(req.query.bookId));
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
