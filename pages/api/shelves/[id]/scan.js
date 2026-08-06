import { scanShelfBook } from "../../../../lib/shelfInventory";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { result, error } = await scanShelfBook(Number(req.query.id), req.body.barcode);
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
