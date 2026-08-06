import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوم — موظف مستودع ما يحتاج تسجيل دخول متكرر

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64) {
  return createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
}

// توكن دخول موظف بتطبيق الجوال — HMAC-SHA256 موقّع، بدون أي حزمة JWT خارجية
export function signEmployeeToken(employeeId) {
  const payload = JSON.stringify({ employeeId, exp: Date.now() + TOKEN_TTL_MS });
  const payloadB64 = base64url(payload);
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyEmployeeToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  const expectedSig = sign(payloadB64);
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (!payload.employeeId || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// يتحقق من رأس Authorization: Bearer <token>، يرجّع الموظف النشط أو يرسل 401 ويرجّع null
export async function requireEmployee(req, res) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token ? verifyEmployeeToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "يلزم تسجيل الدخول" });
    return null;
  }

  const employee = await prisma.employee.findUnique({ where: { id: payload.employeeId } });
  if (!employee || !employee.active) {
    res.status(401).json({ error: "حساب الموظف غير موجود أو معطّل" });
    return null;
  }
  return employee;
}
