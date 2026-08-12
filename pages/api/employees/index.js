import { prisma } from "../../../lib/prisma";
import { hashSecret } from "../../../lib/crypto";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { fulfilledOrders: true, errorLogs: true } } },
    });
    return res.status(200).json(
      employees.map((e) => ({
        id: e.id,
        name: e.name,
        active: e.active,
        hasMobileAccess: Boolean(e.pinHash),
        hasWebAccess: Boolean(e.username),
        role: e.role,
        fulfilledCount: e._count.fulfilledOrders,
        errorCount: e._count.errorLogs,
      }))
    );
  }

  if (req.method === "POST") {
    const { name, pin } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "الاسم مطلوب" });
    if (pin && String(pin).length < 4) {
      return res.status(400).json({ error: "الرقم السري قصير جدًا (4 أرقام على الأقل)" });
    }

    const employee = await prisma.employee.create({
      data: { name: name.trim(), pinHash: pin ? hashSecret(pin) : null },
    });
    return res.status(201).json({ id: employee.id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
