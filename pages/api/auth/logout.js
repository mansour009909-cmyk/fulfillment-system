import { clearSessionCookieHeader } from "../../../lib/webAuth";

// مشترك للثلاثة (إداري/عميل/مورد) — يمسح كوكي الجلسة بغض النظر عن الدور
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Set-Cookie", clearSessionCookieHeader());
  return res.status(200).json({ ok: true });
}
