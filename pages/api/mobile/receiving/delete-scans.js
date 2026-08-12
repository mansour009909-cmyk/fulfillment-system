import { requireEmployee } from "../../../../lib/mobileAuth";
import { deleteUnmatchedScans } from "../../../../lib/receiving";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const { bookId } = req.body;
  if (!bookId) return res.status(400).json({ error: "bookId مطلوب" });

  const { result } = await deleteUnmatchedScans(Number(bookId));
  return res.status(200).json(result);
}
