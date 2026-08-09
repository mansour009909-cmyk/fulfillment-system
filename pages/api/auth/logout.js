import { clearSessionCookieHeader } from "../../../lib/webAuth";

// تسجيل خروج حساب الإدارة فقط — كل دور له كوكي منفصل الآن، فما يأثّر على بوابتي العميل/المورد
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Set-Cookie", clearSessionCookieHeader("ADMIN"));
  return res.status(200).json({ ok: true });
}
