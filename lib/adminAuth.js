import { prisma } from "./prisma";
import { verifySecret } from "./crypto";
import { MODULES } from "./adminModules";

export { MODULES, MANAGER_ONLY_PATHS, moduleForPath } from "./adminModules";

export async function verifyAdminLogin(username, password) {
  const employee = await prisma.employee.findUnique({ where: { username } });
  if (!employee || !employee.active || !employee.username) return null;
  if (!verifySecret(password, employee.passwordHash)) return null;
  return employee;
}

// قراءة حيّة من قاعدة البيانات — يضمن أثر فوري لأي تغيير بالصلاحيات، بدون انتظار جلسة جديدة.
// جلسات قديمة (قبل نظام الصلاحيات) بدون level إطلاقًا — نعاملها كمدير (نفس صلاحياتها الأصلية)
export async function hasModuleAccess(employeeId, level, module) {
  if (!level || level === "MANAGER") return true;
  if (!module) return true; // صفحات بدون قسم محدَّد (الرئيسية) متاحة للكل
  const perm = await prisma.employeePermission.findFirst({ where: { employeeId, module } });
  return Boolean(perm);
}

export async function getUserModules(employeeId, level) {
  if (!level || level === "MANAGER") return Object.keys(MODULES);
  const perms = await prisma.employeePermission.findMany({ where: { employeeId }, select: { module: true } });
  return perms.map((p) => p.module);
}
