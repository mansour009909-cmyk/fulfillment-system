import { prisma } from "../../../lib/prisma";
import { hashSecret } from "../../../lib/crypto";
import { MODULES } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      include: { permissions: { select: { module: true } } },
    });
    return res.status(200).json(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        active: u.active,
        modules: u.permissions.map((p) => p.module),
      }))
    );
  }

  if (req.method === "POST") {
    const { username, password, modules } = req.body;
    if (!username?.trim() || !password) return res.status(400).json({ error: "اسم المستخدم وكلمة السر مطلوبان" });
    if (password.length < 6) return res.status(400).json({ error: "كلمة السر قصيرة جدًا (6 أحرف على الأقل)" });

    const clash = await prisma.adminUser.findUnique({ where: { username: username.trim() } });
    if (clash) return res.status(409).json({ error: "اسم المستخدم هذا مستخدَم بالفعل" });

    const validModules = (Array.isArray(modules) ? modules : []).filter((m) => m in MODULES);

    const user = await prisma.adminUser.create({
      data: {
        username: username.trim(),
        passwordHash: hashSecret(password),
        role: "EMPLOYEE",
        permissions: { create: validModules.map((module) => ({ module })) },
      },
    });
    return res.status(201).json({ id: user.id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
