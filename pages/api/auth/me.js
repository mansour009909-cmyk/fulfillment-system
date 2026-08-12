import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { getUserModules } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  const session = await getSession(req, "ADMIN");
  if (!session) return res.status(401).json({ error: "غير مصرّح" });

  const [modules, user] = await Promise.all([
    getUserModules(session.id, session.level),
    session.id ? prisma.employee.findUnique({ where: { id: session.id } }) : null,
  ]);
  // جلسات قديمة (بدون level) تُعامَل كمدير كامل الصلاحيات — نطابق ذلك بالاستجابة
  // عشان الواجهة (Sidebar) تعرض أقسام المدير بدل ما تخفيها
  return res.status(200).json({ level: session.level || "MANAGER", modules, username: user?.username || null });
}
