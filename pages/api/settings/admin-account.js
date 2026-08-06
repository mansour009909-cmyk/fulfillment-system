import { prisma } from "../../../lib/prisma";
import { getSettings } from "../../../lib/settings";
import { hashSecret, verifySecret } from "../../../lib/crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, currentPassword, newPassword } = req.body;
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ error: "كل الحقول مطلوبة" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "كلمة السر الجديدة قصيرة جدًا (6 أحرف على الأقل)" });
  }

  const settings = await getSettings();
  if (!settings.adminPasswordHash || !verifySecret(currentPassword, settings.adminPasswordHash)) {
    return res.status(401).json({ error: "كلمة السر الحالية غير صحيحة" });
  }

  await prisma.systemSetting.update({
    where: { id: 1 },
    data: { adminUsername: username, adminPasswordHash: hashSecret(newPassword) },
  });
  return res.status(200).json({ ok: true });
}
