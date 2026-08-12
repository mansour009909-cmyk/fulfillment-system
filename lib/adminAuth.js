import { prisma } from "./prisma";
import { verifySecret } from "./crypto";
import { MODULES } from "./adminModules";

export { MODULES, MANAGER_ONLY_PATHS, moduleForPath } from "./adminModules";

export async function verifyAdminLogin(username, password) {
  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user || !user.active) return null;
  if (!verifySecret(password, user.passwordHash)) return null;
  return user;
}

// قراءة حيّة من قاعدة البيانات — يضمن أثر فوري لأي تغيير بالصلاحيات، بدون انتظار جلسة جديدة
export async function hasModuleAccess(adminUserId, level, module) {
  if (level === "MANAGER") return true;
  if (!module) return true; // صفحات بدون قسم محدَّد (الرئيسية) متاحة للكل
  const perm = await prisma.adminPermission.findFirst({ where: { adminUserId, module } });
  return Boolean(perm);
}

export async function getUserModules(adminUserId, level) {
  if (level === "MANAGER") return Object.keys(MODULES);
  const perms = await prisma.adminPermission.findMany({ where: { adminUserId }, select: { module: true } });
  return perms.map((p) => p.module);
}
