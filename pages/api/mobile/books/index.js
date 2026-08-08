import { requireEmployee } from "../../../../lib/mobileAuth";
import { searchBooks } from "../../../../lib/bookCatalog";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const books = await searchBooks(req.query.q, { take: 30 });
  return res.status(200).json({ books });
}
