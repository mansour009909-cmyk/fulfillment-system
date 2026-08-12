// جلسات الويب (إداري/بوابة عميل/بوابة مورد) — HMAC-SHA256 عبر Web Crypto API فقط
// (لا Buffer ولا `node:crypto`) عشان يشتغل نفس الكود بـmiddleware.js (Edge) وبمسارات API (Node) بدون فرق.
//
// كل دور له كوكي منفصل (COOKIE_NAMES) بدل كوكي واحد مشترك — عشان تسجيل الدخول ببوابة العميل
// (مثلاً) ما يسجّل خروج الإداري أو المورد إذا كانوا مسجّلين دخول بنفس المتصفح بنفس الوقت.

const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 أيام، تتجدّد كل طلب
export const COOKIE_NAMES = {
  ADMIN: "admin_session",
  CLIENT: "client_session",
  SUPPLIER: "supplier_session",
};
const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url) {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

function getKey() {
  return crypto.subtle.importKey("raw", encoder.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

// role: "ADMIN" | "CLIENT" | "SUPPLIER"، id مطلوب فقط لـCLIENT/SUPPLIER/ADMIN
// level (ADMIN فقط): "MANAGER" | "EMPLOYEE" — يُستخدم فقط لتحديد المسار السريع (المدير كل شيء)،
// أي تحقق صلاحية فعلي لموظف EMPLOYEE يُعاد قراءته من قاعدة البيانات مباشرة (أثر فوري)
export async function signSession({ role, id, level }) {
  const payload = JSON.stringify({
    role,
    id: id ?? null,
    ...(level ? { level } : {}),
    exp: Date.now() + SESSION_TTL_MS,
  });
  const payloadB64 = toBase64Url(encoder.encode(payload));
  const key = await getKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${toBase64Url(new Uint8Array(sigBuf))}`;
}

export async function verifySessionToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sigB64] = token.split(".");
  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(sigB64), encoder.encode(payloadB64));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload; // {role, id, exp}
  } catch {
    return null;
  }
}

export function readSessionToken(cookieHeader, role) {
  if (!cookieHeader) return null;
  const cookieName = COOKIE_NAMES[role];
  const entry = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName}=`));
  return entry ? decodeURIComponent(entry.slice(cookieName.length + 1)) : null;
}

export function sessionCookieHeader(token, role) {
  const cookieName = COOKIE_NAMES[role];
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    SESSION_TTL_MS / 1000
  }`;
}

export function clearSessionCookieHeader(role) {
  const cookieName = COOKIE_NAMES[role];
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// للاستخدام من مسارات API/getServerSideProps (Node) — يقرأ الكوكي من الطلب مباشرة
export async function getSession(req, role) {
  const token = readSessionToken(req.headers.cookie, role);
  return verifySessionToken(token);
}
