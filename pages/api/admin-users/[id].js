import { prisma } from "../../../lib/prisma";
import { hashSecret } from "../../../lib/crypto";
import { MODULES } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

  const id = Number(req.query.id);
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "الحساب غير موجود" });
  if (user.role === "MANAGER") {
    return res.status(400).json({ error: "ما يمكن تعديل صلاحيات حساب المدير — له كل الصلاحيات دائمًا" });
  }

  const { active, newPassword, modules } = req.body;
  const data = {};
  if (typeof active === "boolean") data.active = active;
  if (newPassword) {
    if (newPassword.length < 6) return res.status(400).json({ error: "كلمة السر قصيرة جدًا (6 أحرف على الأقل)" });
    data.passwordHash = hashSecret(newPassword);
  }

  if (Array.isArray(modules)) {
    const validModules = modules.filter((m) => m in MODULES);
    await prisma.adminPermission.deleteMany({ where: { adminUserId: id } });
    if (validModules.length) {
      await prisma.adminPermission.createMany({ data: validModules.map((module) => ({ adminUserId: id, module })) });
    }
  }

  if (Object.keys(data).length) {
    await prisma.adminUser.update({ where: { id }, data });
  }

  return res.status(200).json({ ok: true });
}
