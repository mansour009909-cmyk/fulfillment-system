import { updateShipping } from "../../../../lib/orderFulfillment";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { result, error } = await updateShipping(Number(req.query.id), req.body);
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
