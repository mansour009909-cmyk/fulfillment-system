import { scanReceiving } from "../../../lib/receiving";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { result, error } = await scanReceiving(req.body.barcode, req.body.quantity || 1);
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
