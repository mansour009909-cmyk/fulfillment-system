import { prisma } from "../../../lib/prisma";
import { hashSecret } from "../../../lib/crypto";

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

  const id = Number(req.query.id);
  const { active, pin } = req.body;
  const data = {};
  if (typeof active === "boolean") data.active = active;
  if (pin) {
    if (String(pin).length < 4) return res.status(400).json({ error: "الرقم السري قصير جدًا (4 أرقام على الأقل)" });
    data.pinHash = hashSecret(pin);
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: "لا يوجد تعديل مُرسَل" });

  await prisma.employee.update({ where: { id }, data });
  return res.status(200).json({ ok: true });
}
