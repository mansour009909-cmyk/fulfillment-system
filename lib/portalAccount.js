import { prisma } from "./prisma";
import { hashSecret, verifySecret } from "./crypto";

// تغيير كلمة سر بوابة العميل/المورد ذاتيًا (يتطلب معرفة كلمة السر الحالية أولًا)
async function changePortalPassword(model, id, { currentPassword, newPassword }) {
  const record = await prisma[model].findUnique({ where: { id } });
  if (!record) return { error: { status: 404, body: { error: "الحساب غير موجود" } } };

  if (!verifySecret(currentPassword, record.passwordHash)) {
    return { error: { status: 401, body: { error: "كلمة السر الحالية غير صحيحة" } } };
  }
  if (!newPassword || String(newPassword).length < 6) {
    return { error: { status: 400, body: { error: "كلمة السر الجديدة قصيرة جدًا (6 أحرف على الأقل)" } } };
  }

  await prisma[model].update({ where: { id }, data: { passwordHash: hashSecret(newPassword) } });
  return { result: { ok: true } };
}

export const changeClientPortalPassword = (id, data) => changePortalPassword("client", id, data);
export const changeSupplierPortalPassword = (id, data) => changePortalPassword("supplier", id, data);
