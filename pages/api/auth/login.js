import { verifyAdminLogin } from "../../../lib/adminAuth";
import { signSession, sessionCookieHeader } from "../../../lib/webAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "اسم المستخدم وكلمة السر مطلوبان" });

  const user = await verifyAdminLogin(username, password);
  if (!user) return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });

  const token = await signSession({ role: "ADMIN", id: user.id, level: user.role });
  res.setHeader("Set-Cookie", sessionCookieHeader(token, "ADMIN"));
  return res.status(200).json({ ok: true });
}
