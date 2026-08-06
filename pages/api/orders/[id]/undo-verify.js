import { undoVerify } from "../../../../lib/orderFulfillment";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orderId = Number(req.query.id);
  const { bookId } = req.body;

  const { result, error } = await undoVerify(orderId, bookId);
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
