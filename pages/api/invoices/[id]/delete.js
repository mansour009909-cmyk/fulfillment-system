import { deleteClientInvoice } from "../../../../lib/clientInvoice";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { result, error } = await deleteClientInvoice(Number(req.query.id));
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
