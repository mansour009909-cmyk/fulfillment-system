import { requireEmployee } from "../../../../../lib/mobileAuth";
import { getBatchSummary } from "../../../../../lib/pickingBatch";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const summary = await getBatchSummary(Number(req.query.id));
  if (!summary) return res.status(404).json({ error: "الدفعة غير موجودة" });
  return res.status(200).json({ summary });
}
