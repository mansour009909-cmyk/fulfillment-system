import { requireEmployee } from "../../../../lib/mobileAuth";
import { getReconcileCandidates } from "../../../../lib/receiving";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const employee = await requireEmployee(req, res);
  if (!employee) return;

  const candidates = await getReconcileCandidates();
  return res.status(200).json({ candidates });
}
