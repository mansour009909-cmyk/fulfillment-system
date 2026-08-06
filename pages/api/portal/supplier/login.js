import { prisma } from "../../../../lib/prisma";
import { verifySecret } from "../../../../lib/crypto";
import { signSession, sessionCookieHeader } from "../../../../lib/webAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "البريد وكلمة السر مطلوبان" });

  const supplier = await prisma.supplier.findUnique({ where: { email } });
  if (!supplier || !supplier.passwordHash || !verifySecret(password, supplier.passwordHash)) {
    return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
  }

  const token = await signSession({ role: "SUPPLIER", id: supplier.id });
  res.setHeader("Set-Cookie", sessionCookieHeader(token));
  return res.status(200).json({ ok: true });
}
