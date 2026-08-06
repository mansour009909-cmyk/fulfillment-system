import { prisma } from "./prisma";

// إعدادات النظام صف واحد ثابت (id = 1) — يُنشأ بالقيم الافتراضية أول مرة يُطلب فيها.
// upsert بدل findUnique+create لأن أكثر من صفحة ممكن تطلب الإعدادات بنفس اللحظة
// (مثلاً Topbar من جهة العميل + getServerSideProps لصفحة أخرى) فيتسابقان على الإنشاء.
export async function getSettings() {
  return prisma.systemSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}
