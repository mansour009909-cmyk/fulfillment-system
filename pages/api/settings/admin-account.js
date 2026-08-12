import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { hashSecret, verifySecret } from "../../../lib/crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getSession(req, "ADMIN");
  if (!session) return res.status(401).json({ error: "غير مصرّح" });
  if (!session.id) {
    return res.status(401).json({ error: "جلسة قديمة — سجّل خروج ثم دخول من جديد قبل تغيير الحساب" });
  }

  const { username, currentPassword, newPassword } = req.body;
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ error: "كل الحقول مطلوبة" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "كلمة السر الجديدة قصيرة جدًا (6 أحرف على الأقل)" });
  }

  const user = await prisma.adminUser.findUnique({ where: { id: session.id } });
  if (!user || !verifySecret(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: "كلمة السر الحالية غير صحيحة" });
  }

  if (username !== user.username) {
    const clash = await prisma.adminUser.findUnique({ where: { username } });
    if (clash) return res.status(409).json({ error: "اسم المستخدم هذا مستخدَم بالفعل" });
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { username, passwordHash: hashSecret(newPassword) },
  });
  return res.status(200).json({ ok: true });
}
