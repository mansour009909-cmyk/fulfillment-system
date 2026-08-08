import { requireEmployee } from "../../../../lib/mobileAuth";
import { searchBooks, listBrands } from "../../../../lib/bookCatalog";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const { q, brand, stock, page } = req.query;
  const [{ books, total, totalPages, page: currentPage }, brands] = await Promise.all([
    searchBooks({ q, brand, stock, page, pageSize: 20 }),
    listBrands(),
  ]);

  return res.status(200).json({ books, total, totalPages, page: currentPage, brands });
}
