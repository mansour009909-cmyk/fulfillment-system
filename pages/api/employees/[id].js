import { prisma } from "../../../lib/prisma";
import { hashSecret } from "../../../lib/crypto";
import { MODULES } from "../../../lib/adminModules";

export default async function handler(req, res) {
  const id = Number(req.query.id);

  if (req.method === "GET") {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        permissions: { select: { module: true } },
        _count: { select: { fulfilledOrders: true, errorLogs: true } },
      },
    });
    if (!employee) return res.status(404).json({ error: "الموظف غير موجود" });
    return res.status(200).json({
      id: employee.id,
      name: employee.name,
      active: employee.active,
      hasMobileAccess: Boolean(employee.pinHash),
      username: employee.username,
      role: employee.role,
      modules: employee.permissions.map((p) => p.module),
      fulfilledCount: employee._count.fulfilledOrders,
      errorCount: employee._count.errorLogs,
    });
  }

  if (req.method === "PATCH") {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ error: "الموظف غير موجود" });

    const { active, pin, name, username, password, newPassword, revokeWebAccess, modules } = req.body;
    const data = {};

    if (typeof active === "boolean") data.active = active;
    if (typeof name === "string" && name.trim()) data.name = name.trim();

    if (pin) {
      if (String(pin).length < 4) return res.status(400).json({ error: "الرقم السري قصير جدًا (4 أرقام على الأقل)" });
      data.pinHash = hashSecret(pin);
    }

    if (username && password) {
      // منح وصول الويب لأول مرة، أو تغيير اسم المستخدم مع كلمة سر جديدة
      if (password.length < 6) return res.status(400).json({ error: "كلمة السر قصيرة جدًا (6 أحرف على الأقل)" });
      if (username.trim() !== employee.username) {
        const clash = await prisma.employee.findUnique({ where: { username: username.trim() } });
        if (clash) return res.status(409).json({ error: "اسم المستخدم هذا مستخدَم بالفعل" });
      }
      data.username = username.trim();
      data.passwordHash = hashSecret(password);
    } else if (newPassword) {
      // إعادة تعيين كلمة سر الويب فقط (اسم المستخدم موجود بالفعل)
      if (!employee.username) return res.status(400).json({ error: "ما عنده وصول ويب أصلًا" });
      if (newPassword.length < 6) return res.status(400).json({ error: "كلمة السر قصيرة جدًا (6 أحرف على الأقل)" });
      data.passwordHash = hashSecret(newPassword);
    }

    if (revokeWebAccess) {
      if (employee.role === "MANAGER") return res.status(400).json({ error: "ما يمكن إلغاء وصول حساب المدير" });
      data.username = null;
      data.passwordHash = null;
      await prisma.employeePermission.deleteMany({ where: { employeeId: id } });
    }

    if (Array.isArray(modules)) {
      if (employee.role === "MANAGER") {
        return res.status(400).json({ error: "ما يمكن تعديل صلاحيات حساب المدير — له كل الصلاحيات دائمًا" });
      }
      const validModules = modules.filter((m) => m in MODULES);
      await prisma.employeePermission.deleteMany({ where: { employeeId: id } });
      if (validModules.length) {
        await prisma.employeePermission.createMany({ data: validModules.map((module) => ({ employeeId: id, module })) });
      }
    }

    if (Object.keys(data).length) {
      await prisma.employee.update({ where: { id }, data });
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ error: "الموظف غير موجود" });
    if (employee.role === "MANAGER") return res.status(400).json({ error: "ما يمكن حذف حساب المدير" });

    try {
      await prisma.employee.delete({ where: { id } });
    } catch {
      return res
        .status(409)
        .json({ error: "ما يمكن حذف هذا الموظف — له سجل عمليات مرتبط. عطّل الحساب بدل الحذف." });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
