import { requireEmployee } from "../../../../lib/mobileAuth";
import { scanReceiving } from "../../../../lib/receiving";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const { result, error } = await scanReceiving(req.body.barcode);
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
