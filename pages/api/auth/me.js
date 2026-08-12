import { getSession } from "../../../lib/webAuth";
import { getUserModules } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  const session = await getSession(req, "ADMIN");
  if (!session) return res.status(401).json({ error: "غير مصرّح" });

  const modules = await getUserModules(session.id, session.level);
  return res.status(200).json({ level: session.level, modules });
}
