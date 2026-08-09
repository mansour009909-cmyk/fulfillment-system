import { getSession } from "../../../../lib/webAuth";
import { changeSupplierPortalPassword } from "../../../../lib/portalAccount";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getSession(req);
  if (!session || session.role !== "SUPPLIER") return res.status(401).json({ error: "غير مصرّح" });

  const { result, error } = await changeSupplierPortalPassword(session.id, req.body);
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
