import { pickBookByBarcode } from "../../../lib/orderFulfillment";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { barcode } = req.body;
  if (!barcode) {
    return res.status(400).json({ error: "الباركود مطلوب" });
  }

  const { result, error } = await pickBookByBarcode(barcode);
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
