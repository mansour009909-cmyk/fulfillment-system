import { getSession } from "../../../lib/webAuth";
import { hasModuleAccess } from "../../../lib/adminAuth";

// يُستدعى داخليًا من middleware.js (Edge، بدون وصول مباشر لقاعدة البيانات) — قراءة حيّة
// من قاعدة البيانات هنا (Node runtime) تضمن أثر فوري لأي تغيير بصلاحيات موظف الويب
export default async function handler(req, res) {
  const session = await getSession(req, "ADMIN");
  if (!session) return res.status(401).json({ allowed: false });

  const module = req.query.module || null;
  const allowed = await hasModuleAccess(session.id, session.level, module);
  return res.status(200).json({ allowed });
}
