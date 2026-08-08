import { createBook } from "../../../lib/bookCatalog";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { result, error } = await createBook(req.body);
  if (error) return res.status(error.status).json(error.body);
  return res.status(201).json({ id: result.id });
}
