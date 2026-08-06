import { requireEmployee } from "../../../../lib/mobileAuth";
import { getActiveBatch, getBatchRoute } from "../../../../lib/pickingBatch";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const active = await getActiveBatch();
  if (!active) return res.status(200).json({ batch: null });

  const route = await getBatchRoute(active.id);
  return res.status(200).json({ batch: route });
}
