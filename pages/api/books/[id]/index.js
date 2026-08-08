import { deleteBook, updateBook } from "../../../../lib/bookCatalog";

export default async function handler(req, res) {
  if (req.method === "DELETE") {
    const { result, error } = await deleteBook(Number(req.query.id));
    if (error) return res.status(error.status).json(error.body);
    return res.status(200).json(result);
  }

  if (req.method === "PATCH") {
    const { result, error } = await updateBook(Number(req.query.id), req.body);
    if (error) return res.status(error.status).json(error.body);
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
