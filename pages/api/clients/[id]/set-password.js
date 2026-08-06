import { prisma } from "../../../../lib/prisma";
import { hashSecret } from "../../../../lib/crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "البريد وكلمة السر مطلوبان" });
  if (password.length < 4) return res.status(400).json({ error: "كلمة السر قصيرة جدًا" });

  const existing = await prisma.client.findUnique({ where: { email } });
  if (existing && existing.id !== Number(req.query.id)) {
    return res.status(409).json({ error: "هذا البريد مستخدم لعميل آخر بالفعل" });
  }

  await prisma.client.update({
    where: { id: Number(req.query.id) },
    data: { email, passwordHash: hashSecret(password) },
  });
  return res.status(200).json({ ok: true });
}
