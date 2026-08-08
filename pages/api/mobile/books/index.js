import { requireEmployee } from "../../../../lib/mobileAuth";
import { searchBooks, listBrands, createBook } from "../../../../lib/bookCatalog";

export default async function handler(req, res) {
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  if (req.method === "GET") {
    const { q, brand, stock, page } = req.query;
    const [{ books, total, totalPages, page: currentPage }, brands] = await Promise.all([
      searchBooks({ q, brand, stock, page, pageSize: 20 }),
      listBrands(),
    ]);
    return res.status(200).json({ books, total, totalPages, page: currentPage, brands });
  }

  if (req.method === "POST") {
    const { result, error } = await createBook(req.body);
    if (error) return res.status(error.status).json(error.body);
    return res.status(201).json(result);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
