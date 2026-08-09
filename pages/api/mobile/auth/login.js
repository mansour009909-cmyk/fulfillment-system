import { prisma } from "../../../../lib/prisma";
import { verifySecret } from "../../../../lib/crypto";
import { signEmployeeToken } from "../../../../lib/mobileAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const name = (req.body.name || "").trim();
  const { pin } = req.body;
  if (!name || !pin) return res.status(400).json({ error: "اسم المستخدم والرقم السري مطلوبان" });

  const employee = await prisma.employee.findFirst({ where: { name, active: true } });
  if (!employee || !verifySecret(pin, employee.pinHash)) {
    return res.status(401).json({ error: "اسم المستخدم أو الرقم السري غير صحيح" });
  }

  const token = signEmployeeToken(employee.id);
  return res.status(200).json({ token, employee: { id: employee.id, name: employee.name } });
}
