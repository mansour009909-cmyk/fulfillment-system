import { getSettings } from "../../../lib/settings";
import { verifySecret } from "../../../lib/crypto";
import { signSession, sessionCookieHeader } from "../../../lib/webAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "اسم المستخدم وكلمة السر مطلوبان" });

  const settings = await getSettings();
  if (
    username !== settings.adminUsername ||
    !settings.adminPasswordHash ||
    !verifySecret(password, settings.adminPasswordHash)
  ) {
    return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
  }

  const token = await signSession({ role: "ADMIN" });
  res.setHeader("Set-Cookie", sessionCookieHeader(token));
  return res.status(200).json({ ok: true });
}
