import { requireEmployee } from "../../../../lib/mobileAuth";
import { createBatch } from "../../../../lib/pickingBatch";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const { result, error } = await createBatch(employee.id);
  if (error) return res.status(error.status).json(error.body);
  return res.status(201).json(result);
}
