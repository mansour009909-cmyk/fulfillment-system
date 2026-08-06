import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// تجزئة أرقام سرية/كلمات سر (PIN موظفين، كلمة سر إدارة، كلمة سر بوابات العملاء/الموردين)
// scrypt المدمجة بـNode — بدون أي حزمة خارجية جديدة
export function hashSecret(plain) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(plain), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(plain, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(String(plain), salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
