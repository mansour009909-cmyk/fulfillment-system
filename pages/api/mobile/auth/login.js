import { prisma } from "../../../../lib/prisma";
import { verifySecret } from "../../../../lib/crypto";
import { signEmployeeToken } from "../../../../lib/mobileAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: "الرقم السري مطلوب" });

  const employees = await prisma.employee.findMany({ where: { active: true } });
  const employee = employees.find((e) => verifySecret(pin, e.pinHash));
  if (!employee) {
    return res.status(401).json({ error: "الرقم السري غير صحيح" });
  }

  const token = signEmployeeToken(employee.id);
  return res.status(200).json({ token, employee: { id: employee.id, name: employee.name } });
}
